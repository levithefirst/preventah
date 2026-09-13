'use client';

import type { ActiveStakeView, AppState } from '@/lib/state';
import { addUtcDays, todayIso, utcDayOfWeek } from '@/lib/dates';
import TxReference from './TxReference';

const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * One tile per day of the commitment window.
 *
 * Every date operation here goes through the total helpers in lib/dates:
 * an unreadable end date yields null and this renders a short fallback,
 * rather than throwing RangeError out of render and taking the whole
 * authenticated screen down with it.
 */
function StreakDots({ stake }: { stake: ActiveStakeView }) {
  // The window runs backwards from its end date, so the first tile is the
  // day the stake was confirmed.
  const start = addUtcDays(stake.endsOn, -(stake.windowDays - 1));

  if (start === null) {
    return (
      <p className="faint">
        {stake.checkinCount} of {stake.targetDays} days checked in.
      </p>
    );
  }

  const today = todayIso();
  const done = new Set(stake.checkinDates);

  return (
    <div className="dots">
      {Array.from({ length: stake.windowDays }, (_, i) => {
        const date = addUtcDays(start, i);
        if (date === null) return null;

        const isDone = done.has(date);
        const isToday = date === today;
        const weekday = utcDayOfWeek(date);
        const label = weekday === null ? '\u2022' : WEEKDAY[weekday];

        return (
          <div
            key={date}
            className={`dot${isDone ? ' done' : ''}${isToday ? ' today' : ''}`}
            title={date}
          >
            {isDone ? '\u2713' : label}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The commitment surface. Covers all four states a user can be in:
 * no stake, stake confirming on-chain, streak running, and target reached.
 */
export default function CommitmentCard({
  state,
  busy,
  pendingReason,
  verifyStalled,
  onStake,
  onCheckIn,
  onRecheck,
}: {
  state: AppState;
  busy: string | null;
  pendingReason: string | null;
  verifyStalled: boolean;
  onStake: () => void;
  onCheckIn: () => void;
  onRecheck: () => void;
}) {
  const stake = state.activeStake;

  // --- No commitment yet ---------------------------------------------------
  if (!stake) {
    const ready = state.selections.length > 0;
    return (
      <section className="card">
        <div className="card-head">
          <h2>Commit</h2>
          <span className="badge">
            {state.config.targetDays} of {state.config.windowDays} days
          </span>
        </div>

        <p className="muted">
          Stake {state.config.stakeAmountUsdt} USDT and check in on{' '}
          {state.config.targetDays} days out of {state.config.windowDays}. Hit
          the target and your stake comes back with a reward on top.
        </p>

        <div className="notice info" style={{ marginTop: 14 }}>
          Miss the target and your stake is still returned in full. Preventah
          never keeps your deposit.
        </div>

        <div className="row-between" style={{ margin: '16px 0 14px' }}>
          <span className="muted">Your stake</span>
          <span className="amount">{state.config.stakeAmountUsdt} USDT</span>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          disabled={!ready || busy !== null}
          onClick={onStake}
        >
          {busy === 'stake' ? <span className="spinner" /> : null}
          {busy === 'stake'
            ? 'Confirm in Nimiq Pay'
            : `Stake ${state.config.stakeAmountUsdt} USDT to commit`}
        </button>

        <p className="faint" style={{ marginTop: 10, textAlign: 'center' }}>
          Paid in USDT on Polygon. Nimiq Pay will ask you to confirm.
        </p>
      </section>
    );
  }

  // --- Stake broadcast, waiting on confirmations ---------------------------
  if (stake.status === 'pending') {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Confirming your stake</h2>
          <span className={`badge ${verifyStalled ? 'bad' : 'warn'}`}>
            {verifyStalled ? 'Not confirmed yet' : 'On-chain'}
          </span>
        </div>

        {verifyStalled ? (
          <>
            <div className="notice error">
              {pendingReason ?? 'We could not confirm your payment yet.'}
            </div>
            <p className="muted">
              Your {stake.amountUsdt} USDT payment was sent and your funds are
              not lost. Confirmation just has not completed yet. Check again
              now, or reopen Preventah later &mdash; the daily settlement job
              also retries pending stakes on its own.
            </p>
          </>
        ) : (
          <>
            <p className="muted">
              Your {stake.amountUsdt} USDT payment is waiting for confirmations
              on Polygon. This usually takes under a minute, and it keeps
              running if you close the app.
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '18px 0',
              }}
            >
              <span className="spinner dark" style={{ width: 26, height: 26 }} />
            </div>
            {pendingReason ? (
              <p className="faint" style={{ textAlign: 'center' }}>
                {pendingReason}
              </p>
            ) : null}
          </>
        )}

        <button
          type="button"
          className={`btn ${verifyStalled ? 'btn-primary' : 'btn-secondary'}`}
          disabled={busy !== null}
          onClick={onRecheck}
        >
          {busy === 'recheck' ? <span className="spinner" /> : null}
          {busy === 'recheck' ? 'Checking' : 'Check again'}
        </button>

        <TxReference hash={stake.txHash} label="Your payment" />
      </section>
    );
  }

  // --- Streak running or target reached ------------------------------------
  const pct = Math.min(100, (stake.checkinCount / stake.targetDays) * 100);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Your streak</h2>
        {stake.targetMet ? (
          <span className="badge ok">Target reached</span>
        ) : stake.daysRemaining !== null ? (
          <span className="badge">
            {stake.daysRemaining} day{stake.daysRemaining === 1 ? '' : 's'} left
          </span>
        ) : (
          <span className="badge">In progress</span>
        )}
      </div>

      <div className="streak-row">
        <div
          className="ring"
          style={{ ['--pct' as string]: String(pct) }}
          role="img"
          aria-label={`${stake.checkinCount} of ${stake.targetDays} days checked in`}
        >
          <div className="ring-inner">
            <div>
              <div className="ring-count">{stake.checkinCount}</div>
              <div className="ring-of">of {stake.targetDays}</div>
            </div>
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="muted" style={{ marginBottom: 2 }}>
            {stake.amountUsdt} USDT staked
          </div>
          <StreakDots stake={stake} />
        </div>
      </div>

      {stake.targetMet ? (
        <div className="notice good">
          You hit your target. Your stake and reward are sent back
          automatically at the next daily settlement.
        </div>
      ) : null}

      <button
        type="button"
        className={`btn ${stake.checkedInToday ? 'btn-secondary' : 'btn-success'}`}
        disabled={stake.checkedInToday || busy !== null}
        onClick={onCheckIn}
      >
        {busy === 'checkin' ? <span className="spinner" /> : null}
        {stake.checkedInToday
          ? "✓ Checked in today"
          : "I followed today's plan"}
      </button>

      {stake.checkedInToday && !stake.targetMet ? (
        <p className="faint" style={{ marginTop: 10, textAlign: 'center' }}>
          Come back tomorrow to keep the streak going.
        </p>
      ) : null}
    </section>
  );
}
