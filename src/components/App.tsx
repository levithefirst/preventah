'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toBaseUnits } from '@/lib/config';
import type { ConditionId } from '@/lib/conditions';
import type { AppState } from '@/lib/state';
import { api, type ApiResult } from '@/lib/api-client';
import {
  WalletError,
  connectEvmAccount,
  detectHost,
  sendUsdtStake,
  signLoginMessage,
} from '@/lib/wallet';
import RenderErrorBoundary from './RenderErrorBoundary';
import Window from './ui/Window';
import Button from './ui/Button';
import { Toasts, type ToastMessage } from './ui/Toast';
import { ErrorNotice } from './ui/States';
import { SiteHome } from './site/SiteHome';
import Masthead from './Masthead';
import ConsentCard from './ConsentCard';
import ConditionsCard from './ConditionsCard';
import ProgressCard from './ProgressCard';
import ReminderCard from './ReminderCard';
import PlanCard from './PlanCard';
import CommitmentCard from './CommitmentCard';
import HistoryCard from './HistoryCard';

type Phase = 'booting' | 'site' | 'connect' | 'ready';

/** How long to keep polling a pending stake before telling the user to wait. */
const VERIFY_POLL_MS = 5000;
const VERIFY_MAX_ATTEMPTS = 24;

export default function App() {
  const [phase, setPhase] = useState<Phase>('booting');
  const [state, setState] = useState<AppState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [pendingReason, setPendingReason] = useState<string | null>(null);
  const [verifyStalled, setVerifyStalled] = useState(false);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttempts = useRef(0);
  const pollRef = useRef<() => void>(() => {});

  // --- boot ---------------------------------------------------------------
  //
  // Two questions, asked at once rather than one after the other: which host
  // are we in, and is there already a session?
  //
  // Serially this cost a public visitor up to 17.5 seconds of spinner (2.5s
  // of SDK handshake, then a 15s API timeout) before any content appeared,
  // for a request that was never going to be useful to them. In parallel,
  // the host answer alone is enough to decide: outside Nimiq Pay there is no
  // wallet to connect to, so the visitor gets the public site and the /api/me
  // result is simply never read.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = api('/api/me');
      const info = await detectHost();
      if (cancelled) return;

      if (!info.insideNimiqPay) {
        setPhase('site');
        return;
      }

      // An existing session cookie means the wallet was already proved.
      const result = await session;
      if (cancelled) return;

      if (result.ok && result.state) {
        setState(result.state);
        setPhase('ready');
      } else {
        // A 401 here is the normal "not signed in yet" case and must stay
        // silent. Only surface a failure that never reached the server.
        if (result.offline && result.error) setError(result.error);
        setPhase('connect');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // --- poll a pending stake ------------------------------------------------
  //
  // Polling must always reach a terminal state. Previously it simply stopped
  // after VERIFY_MAX_ATTEMPTS while the pending card kept rendering a
  // spinner, so any stake that did not confirm inside the window appeared to
  // hang forever with no explanation and no way to retry.
  const verifyOnce = useCallback(async () => {
    pollAttempts.current += 1;
    const result = await api('/api/stake/verify', { method: 'POST' });

    if (result.state) setState(result.state);

    if (!result.ok) {
      // A rejected stake (422) or a server fault. Either way, stop and say so.
      setPendingReason(result.error ?? 'Could not check the transaction.');
      setVerifyStalled(true);
      return;
    }

    if (!result.pending) {
      setPendingReason(null);
      setVerifyStalled(false);
      return;
    }

    setPendingReason(typeof result.reason === 'string' ? result.reason : null);

    if (pollAttempts.current >= VERIFY_MAX_ATTEMPTS) {
      setVerifyStalled(true);
      return;
    }
    pollRef.current();
  }, []);

  const schedulePoll = useCallback(() => {
    // One timer slot, cleared first, so overlapping callers collapse into a
    // single chain rather than compounding.
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(() => {
      void verifyOnce();
    }, VERIFY_POLL_MS);
  }, [verifyOnce]);

  useEffect(() => {
    pollRef.current = schedulePoll;
  }, [schedulePoll]);

  useEffect(() => {
    if (state?.activeStake?.status === 'pending' && !verifyStalled) {
      schedulePoll();
    }
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [state?.activeStake?.status, verifyStalled, schedulePoll]);

  // --- actions -------------------------------------------------------------

  /**
   * Queue a confirmation.
   *
   * Toasts replaced the old inline notice row, which pushed the page down
   * and moved the button the user had just pressed out from under their
   * thumb. Errors that block progress still render inline, in the card they
   * belong to.
   */
  const toast = useCallback((text: string, tone: 'good' | 'error' = 'good') => {
    setToasts((current) => [...current, { id: Date.now() + Math.random(), text, tone }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  /** Applies an API result, surfacing its error rather than swallowing it. */
  function apply(result: ApiResult): boolean {
    if (result.state) setState(result.state);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong.');
      return false;
    }
    setError(null);
    return true;
  }

  function handleWalletError(err: unknown) {
    if (err instanceof WalletError) {
      setError(err.message);
    } else {
      console.error(err);
      setError('Something went wrong talking to your wallet.');
    }
  }

  const connect = useCallback(async () => {
    setBusy('connect');
    setError(null);


    try {
      const address = await connectEvmAccount();

      const challenge = await api('/api/auth/nonce', { method: 'POST' });
      if (!challenge.ok) {
        setError(challenge.error ?? 'Could not start the login.');
        return;
      }

      const { nonce, message } = challenge as unknown as {
        nonce: string;
        message: string;
      };

      const signature = await signLoginMessage(address, message);

      const verified = await api('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ address, signature, nonce }),
      });
      if (!verified.ok) {
        setError(verified.error ?? 'Could not verify your wallet.');
        return;
      }

      const me = await api('/api/me');

      const applied = apply(me);

      if (applied) {
        setPhase('ready');
      }
    } catch (err) {
      handleWalletError(err);
    } finally {
      setBusy(null);
    }
  }, []);

  const acceptConsent = useCallback(async () => {
    setBusy('consent');
    const result = await api('/api/consent', {
      method: 'POST',
      body: JSON.stringify({
        granted: true,
        consentVersion: state?.consentVersion,
      }),
    });
    apply(result);
    setBusy(null);
  }, [state?.consentVersion]);

  const withdrawConsent = useCallback(async () => {
    const confirmed = window.confirm(
      'Withdraw consent and delete your saved conditions and measurements? Any stake already in progress is unaffected and will still be returned.',
    );
    if (!confirmed) return;

    setBusy('withdraw');
    const result = await api('/api/consent', { method: 'DELETE' });
    if (apply(result)) toast('Your health data has been deleted.');
    setBusy(null);
  }, [toast]);

  const saveConditions = useCallback(async (keys: ConditionId[]) => {
    setBusy('conditions');
    const result = await api('/api/conditions', {
      method: 'POST',
      body: JSON.stringify({ keys }),
    });
    apply(result);
    setBusy(null);
  }, []);

  const recordMeasurement = useCallback(
    async (input: {
      kind: string;
      unit: string;
      value: string;
      valueSecondary: string;
      measuredOn: string;
    }) => {
      setBusy('measurement');
      const result = await api('/api/measurements', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (apply(result)) toast('Reading added.');
      setBusy(null);
    },
    [toast],
  );

  const deleteMeasurement = useCallback(async (id: string) => {
    setBusy('measurement');
    const result = await api('/api/measurements', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    if (apply(result)) toast('Reading deleted.');
    setBusy(null);
  }, [toast]);

  const stake = useCallback(async () => {
    if (!state) return;
    setBusy('stake');
    setError(null);
    try {
      const hash = await sendUsdtStake({
        from: state.address,
        to: state.config.escrowAddress,
        amountBase: toBaseUnits(state.config.stakeAmountUsdt),
      });

      const result = await api('/api/stake', {
        method: 'POST',
        body: JSON.stringify({ txHash: hash }),
      });
      if (apply(result)) {
        pollAttempts.current = 0;
        setVerifyStalled(false);
        setPendingReason(
          typeof result.reason === 'string' ? result.reason : null,
        );
        toast(
          result.pending
            ? 'Transfer sent. Confirming on Polygon now.'
            : 'You are committed. Mark today done to start.',
        );
      }
    } catch (err) {
      handleWalletError(err);
    } finally {
      setBusy(null);
    }
  }, [state, toast]);

  /** Manual re-check, so a stalled confirmation is always recoverable. */
  const recheckStake = useCallback(async () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollAttempts.current = 0;
    setVerifyStalled(false);
    setError(null);
    setBusy('recheck');
    await verifyOnce();
    setBusy(null);
  }, [verifyOnce]);

  const checkIn = useCallback(async () => {
    setBusy('checkin');
    const result = await api('/api/checkin', { method: 'POST' });
    if (apply(result)) {
      toast(
        result.alreadyCheckedIn
          ? 'You already checked in today.'
          : 'Checked in.',
      );
    }
    setBusy(null);
  }, []);

  // --- render --------------------------------------------------------------

  // The handshake takes up to 2.5 seconds. Say who we are for that time
  // rather than showing a bare spinner on an empty field.
  if (phase === 'booting') {
    return (
      <main className="shell">
        <Masthead />
        <Window bar="Welcome" offset size="roomy">
          <h1 style={{ marginBottom: 12 }}>Stay ahead of family history.</h1>
          <p className="muted">
            Know your family history. Build better habits. Stay ahead.
          </p>
          <div className="pv-center-pad">
            <span
              className="pv-spinner"
              style={{ width: 26, height: 26 }}
              role="img"
              aria-label="Opening Preventah"
            />
          </div>
        </Window>
      </main>
    );
  }

  /*
    Outside Nimiq Pay there is no wallet to connect to, so a connect button
    would be a dead end. A visitor who reached the production URL in a normal
    browser gets the public site instead: the same brand system, everything
    explained, and a deeplink that opens the real thing.

    This is also why the Mini App stays mounted at "/". That URL is the
    registered Nimiq Pay deeplink target, and moving it would break every
    existing entry point.
  */
  if (phase === 'site') {
    return <SiteHome />;
  }

  if (phase === 'connect') {
    return (
      <main className="shell">
        <Masthead />
        {error ? <ErrorNotice>{error}</ErrorNotice> : null}

        <Window bar="Welcome" offset size="roomy">
          <h1 style={{ marginBottom: 12 }}>Stay ahead of family history.</h1>

          <p className="muted">
            Know your family history. Build better habits. Stay ahead.
          </p>
          <p className="muted">
            Pick what runs in your family and Preventah gives you a small,
            specific plan each day: one diet change, one bit of movement, one
            habit. Back it with a USDT commitment you get back for showing up.
          </p>

          <Button
            variant="primary"
            offset
            busy={busy === 'connect'}
            busyLabel="Check your wallet"
            onClick={connect}
            style={{ marginTop: 20 }}
          >
            Continue with Nimiq Pay
          </Button>

          <p className="faint" style={{ marginTop: 12, textAlign: 'center' }}>
            Preventah uses your Nimiq Pay wallet. Keys stay in Nimiq Pay. You
            will be asked to sign a free message &mdash; no funds move.
          </p>
        </Window>

        <p className="footer-note">
          Preventah is a prevention-habit tool. It is not medical advice, a
          diagnosis, or a payment-yield product.
        </p>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="shell">
        <Masthead />
        <Window bar="Could not load" barTone="blush" offset>
          <p className="muted">
            Preventah could not load your account. Reopening the app usually
            clears it. Your commitment and your funds are unaffected.
          </p>
        </Window>
      </main>
    );
  }

  const short = `${state.address.slice(0, 6)}...${state.address.slice(-4)}`;

  return (
    <main className="shell">
      <Masthead subtitle={short} />
      {error ? <ErrorNotice>{error}</ErrorNotice> : null}

      <RenderErrorBoundary>
      {!state.hasConsent ? (
        <>
          <ConsentCard
            consentVersion={state.consentVersion}
            busy={busy === 'consent'}
            onAccept={acceptConsent}
          />

          {/*
            A commitment is money and a streak, not health data. Consent
            covers what Preventah stores about your family history and your
            measurements, and withdrawing it must never cost you either. So
            a running commitment stays visible and checkable while consent
            is absent, with the general plan rather than a tailored one.
          */}
          {state.activeStake ? (
            <>
              <PlanCard plan={state.plan} />

              <CommitmentCard
                state={state}
                busy={busy}
                pendingReason={pendingReason}
                verifyStalled={verifyStalled}
                onStake={stake}
                onCheckIn={checkIn}
                onRecheck={recheckStake}
              />
            </>
          ) : null}
        </>
      ) : state.selections.length === 0 ? (
        <ConditionsCard
          initial={state.selections}
          labels={state.selectionLabels}
          busy={busy === 'conditions'}
          onSave={saveConditions}
        />
      ) : (
        <>
          <PlanCard plan={state.plan} />

          <CommitmentCard
            state={state}
            busy={busy}
            pendingReason={pendingReason}
            verifyStalled={verifyStalled}
            onStake={stake}
            onCheckIn={checkIn}
            onRecheck={recheckStake}
          />

          <ConditionsCard
            key={state.selections.join(',')}
            initial={state.selections}
            labels={state.selectionLabels}
            busy={busy === 'conditions'}
            compact
            onSave={saveConditions}
          />

          <ProgressCard
            measurements={state.measurements}
            today={state.today}
            busy={busy === 'measurement'}
            onRecord={recordMeasurement}
            onDelete={deleteMeasurement}
          />

          <ReminderCard />

          <HistoryCard history={state.history} />

          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <button
              type="button"
              className="btn-danger-text"
              disabled={busy !== null}
              onClick={withdrawConsent}
            >
              Withdraw consent and delete my health data
            </button>
          </div>
        </>
      )}
      </RenderErrorBoundary>

      <p className="footer-note">
        Preventah gives general lifestyle guidance, not medical advice. It does
        not diagnose or treat anything. Talk to a clinician about your family
        history.
      </p>
    </main>
  );
}
