'use client';

import type { ActiveStakeView, AppState } from '@/lib/state';
import { addUtcDays, todayIso, utcDayOfWeek } from '@/lib/dates';
import TxReference from './TxReference';
import Window, { WindowHead } from './ui/Window';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { ErrorNotice, Notice } from './ui/States';

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * One square per day of the commitment window.
 *
 * A missed day is cream with a soft border, never a red cross. Missing a day
 * costs nothing here: the stake comes back either way, and marking it in
 * alarm colours would be a lie about the stakes as well as unkind.
 *
 * Every date operation goes through the total helpers in lib/dates. An
 * unreadable end date yields null and this renders a short fallback rather
 * than throwing RangeError out of render and taking the authenticated screen
 * down with it.
 */
function WeekSquares({ stake }: { stake: ActiveStakeView }) {
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
    <div className="pv-week">
      {Array.from({ length: stake.windowDays }, (_, i) => {
        const date = addUtcDays(start, i);
        if (date === null) return null;

        const isDone = done.has(date);
        const isToday = date === today;
        const weekday = utcDayOfWeek(date);
        const label = weekday === null ? '•' : WEEKDAY[weekday];

        return (
          <div
            key={date}
            className={`pv-day${isDone ? ' pv-day-done' : ''}${
              isToday ? ' pv-day-today' : ''
            }`}
            title={`${date}${isDone ? ' — checked in' : ''}`}
          >
            {isDone ? (
              <svg
                viewBox="0 0 20 20"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m4 10 4 4 8-8" />
              </svg>
            ) : (
              label
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The commitment surface. Four states: no stake, stake confirming on-chain,
 * streak running, and target reached.
 *
 * Money screens drop the playfulness and keep the geometry. The bar is ink
 * rather than mint everywhere real USDT is being discussed, so the moment
 * the app asks for a transfer looks different from the moment it asks about
 * a walk.
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
      <Window bar="Commitment" barTone="ink" offset size="roomy">
        <div className="pv-money-row">
          <div>
            <span className="label">Your commitment</span>
            <div className="pv-stat" style={{ marginTop: 4 }}>
              {state.config.stakeAmountUsdt} USDT
            </div>
          </div>
          <Badge>
            {state.config.targetDays} of {state.config.windowDays} days
          </Badge>
        </div>

        <p className="muted" style={{ marginTop: 16 }}>
          Check in on {state.config.targetDays} days out of{' '}
          {state.config.windowDays}. Hit the target and your commitment comes
          back with a reward on top.
        </p>

        <Notice tone="good">
          Miss the target and your commitment is still returned in full.
          Preventah never keeps a deposit.
        </Notice>

        <Button
          variant="primary"
          offset
          disabled={!ready}
          busy={busy === 'stake'}
          busyLabel="Approve in Nimiq Pay"
          onClick={onStake}
        >
          Commit {state.config.stakeAmountUsdt} USDT
        </Button>

        {!ready ? (
          <p className="faint" style={{ marginTop: 10, textAlign: 'center' }}>
            Pick your family history first.
          </p>
        ) : (
          <p className="faint" style={{ marginTop: 10, textAlign: 'center' }}>
            This is a real USDT transfer on Polygon. Nimiq Pay will ask you to
            approve it. Preventah does not hold your keys.
          </p>
        )}
      </Window>
    );
  }

  // --- Stake broadcast, waiting on confirmations ---------------------------
  if (stake.status === 'pending') {
    return (
      <Window bar="Commitment" barTone="ink" offset size="roomy">
        <WindowHead
          title="Confirming your transfer"
          aside={
            <Badge tone={verifyStalled ? 'bad' : 'warn'}>
              {verifyStalled ? 'Not confirmed' : 'On-chain'}
            </Badge>
          }
        />

        {verifyStalled ? (
          <>
            <ErrorNotice>
              {pendingReason ?? 'We could not confirm your payment yet.'}
            </ErrorNotice>
            <p className="muted">
              Your {stake.amountUsdt} USDT transfer was sent and your funds are
              not lost. Confirmation just has not completed yet. Check again
              now, or reopen Preventah later &mdash; the daily settlement job
              also retries pending commitments on its own.
            </p>
          </>
        ) : (
          <>
            <p className="muted">
              Your {stake.amountUsdt} USDT transfer is waiting for
              confirmations on Polygon. This usually takes under a minute, and
              it keeps running if you close the app.
            </p>
            <div className="pv-center-pad">
              <span
                className="pv-spinner"
                style={{ width: 26, height: 26 }}
                aria-label="Waiting for confirmations"
                role="img"
              />
            </div>
            {pendingReason ? (
              <p className="faint" style={{ textAlign: 'center' }}>
                {pendingReason}
              </p>
            ) : null}
          </>
        )}

        <Button
          variant={verifyStalled ? 'primary' : 'secondary'}
          offset={verifyStalled}
          busy={busy === 'recheck'}
          busyLabel="Checking"
          onClick={onRecheck}
        >
          Check again
        </Button>

        <TxReference hash={stake.txHash} label="Your transfer" />
      </Window>
    );
  }

  // --- Streak running or target reached ------------------------------------
  const remaining = Math.max(0, stake.targetDays - stake.checkinCount);

  return (
    <Window
      bar={stake.checkedInToday ? 'Checked in' : 'Today'}
      barTone={stake.checkedInToday ? 'done' : 'mint'}
      barNote={
        stake.targetMet
          ? 'Target reached'
          : stake.daysRemaining !== null
            ? `${stake.daysRemaining} day${stake.daysRemaining === 1 ? '' : 's'} left`
            : undefined
      }
      offset
      size="roomy"
    >
      <div className="pv-streak-head">
        <span className="pv-stat">{stake.checkinCount}</span>
        <div>
          <span className="label">
            of {stake.targetDays} days
          </span>
          <p className="faint" style={{ margin: 0 }}>
            Days you checked in.
          </p>
        </div>
      </div>

      <WeekSquares stake={stake} />

      <div className="pv-money-row" style={{ marginTop: 20 }}>
        <span className="label">Committed</span>
        <span className="amount">{stake.amountUsdt} USDT</span>
      </div>

      {stake.targetMet ? (
        <Notice tone="good">
          You hit your target. Your commitment and reward are sent back
          automatically at the next daily settlement.
        </Notice>
      ) : null}

      <Button
        variant={stake.checkedInToday ? 'secondary' : 'primary'}
        offset={!stake.checkedInToday}
        disabled={stake.checkedInToday}
        busy={busy === 'checkin'}
        busyLabel="Marking"
        onClick={onCheckIn}
      >
        {stake.checkedInToday ? 'Done for today' : 'Mark today done'}
      </Button>

      {stake.checkedInToday && !stake.targetMet ? (
        <p className="faint" style={{ marginTop: 10, textAlign: 'center' }}>
          {remaining === 0
            ? 'Come back tomorrow to keep it going.'
            : `Come back tomorrow. ${remaining} more to hit your target.`}
        </p>
      ) : null}
    </Window>
  );
}
