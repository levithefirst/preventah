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
  type HostInfo,
} from '@/lib/wallet';
import RenderErrorBoundary from './RenderErrorBoundary';
import Masthead from './Masthead';
import ConsentCard from './ConsentCard';
import ConditionsCard from './ConditionsCard';
import ProgressCard from './ProgressCard';
import ReminderCard from './ReminderCard';
import PlanCard from './PlanCard';
import CommitmentCard from './CommitmentCard';
import HistoryCard from './HistoryCard';

type Phase = 'booting' | 'connect' | 'ready';

/** How long to keep polling a pending stake before telling the user to wait. */
const VERIFY_POLL_MS = 5000;
const VERIFY_MAX_ATTEMPTS = 24;

export default function App() {
  const [phase, setPhase] = useState<Phase>('booting');
  const [host, setHost] = useState<HostInfo | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [pendingReason, setPendingReason] = useState<string | null>(null);
  const [verifyStalled, setVerifyStalled] = useState(false);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttempts = useRef(0);
  const pollRef = useRef<() => void>(() => {});

  // --- boot ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const info = await detectHost();
      if (cancelled) return;
      setHost(info);

      // An existing session cookie means the wallet was already proved.
      const result = await api('/api/me');
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
    if (apply(result)) setFlash('Your health data has been deleted.');
    setBusy(null);
  }, []);

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
      if (apply(result)) setFlash('Recorded.');
      setBusy(null);
    },
    [],
  );

  const deleteMeasurement = useCallback(async (id: string) => {
    setBusy('measurement');
    const result = await api('/api/measurements', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    if (apply(result)) setFlash('Deleted.');
    setBusy(null);
  }, []);

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
        setFlash(
          result.pending
            ? 'Payment sent. Confirming on Polygon now.'
            : 'You are committed. Check in every day.',
        );
      }
    } catch (err) {
      handleWalletError(err);
    } finally {
      setBusy(null);
    }
  }, [state]);

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
      setFlash(
        result.alreadyCheckedIn
          ? 'You already checked in today.'
          : 'Checked in. Nice work.',
      );
    }
    setBusy(null);
  }, []);

  // Clear the flash message after a moment so it does not linger.
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  // --- render --------------------------------------------------------------

  if (phase === 'booting') {
    return (
      <main className="shell">
        <Masthead />
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <span className="spinner dark" style={{ width: 26, height: 26 }} />
        </div>
      </main>
    );
  }

  const notices = (
    <>
      {error ? <div className="notice error">{error}</div> : null}
      {flash ? <div className="notice good">{flash}</div> : null}
    </>
  );

  if (phase === 'connect') {
    return (
      <main className="shell">
        <Masthead />
        {notices}

        <section className="card">
          <h2>Your family history, turned into a daily habit</h2>
          <p className="muted" style={{ marginTop: 10 }}>
            Pick the conditions that run in your family. Preventah gives you a
            small, specific plan each day: one diet change, one bit of
            movement, one habit.
          </p>
          <p className="muted">
            Back it with a USDT stake. Show up, and you get it back with a
            reward. Miss the target, and you still get your stake back in full.
          </p>

          {host && !host.insideNimiqPay ? (
            <div className="notice info" style={{ marginTop: 14 }}>
              Preventah is a Nimiq Pay Mini App. Open it inside Nimiq Pay to
              connect your wallet and stake.
            </div>
          ) : null}

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            disabled={busy !== null}
            onClick={connect}
          >
            {busy === 'connect' ? <span className="spinner" /> : null}
            {busy === 'connect' ? 'Check your wallet' : 'Connect wallet'}
          </button>

          <p className="faint" style={{ marginTop: 12, textAlign: 'center' }}>
            You will be asked to sign a free message. No funds move.
          </p>
        </section>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="shell">
        <Masthead />
        <div className="notice error">
          Could not load your account. Please reopen the app.
        </div>
      </main>
    );
  }


  const short = `${state.address.slice(0, 6)}...${state.address.slice(-4)}`;

  return (
    <main className="shell">
      <Masthead subtitle={short} />
      {notices}

      <RenderErrorBoundary>
      {!state.hasConsent ? (
        <ConsentCard
          consentVersion={state.consentVersion}
          busy={busy === 'consent'}
          onAccept={acceptConsent}
        />
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
