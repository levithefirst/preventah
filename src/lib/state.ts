import 'server-only';
import {
  CHAIN_ID,
  CONSENT_VERSION,
  ESCROW_WALLET_ADDRESS,
  STAKE_AMOUNT_USDT,
  TARGET_DAYS,
  USDT_ADDRESS,
  WINDOW_DAYS,
  formatUsdt,
} from './config';
import type { ConditionId } from './conditions';
import { daysUntilInclusive, toIsoDate, todayIso } from './dates';
import {
  describeTrend,
  type MeasurementKind,
  type MeasurementPoint,
  type Trend,
} from './measurements';
import { calendarDayIndex, dayIndexSince, getDailyPlan, type DailyPlan } from './plans';
import {
  getActiveStake,
  getCheckinDates,
  getMeasurements,
  getSelections,
  getStakeHistory,
  hasActiveConsent,
  type MeasurementRow,
  type StakeRow,
  type UserRow,
} from './repo';

/** The single payload the client renders from. */
export interface AppState {
  address: string;
  /**
   * Today's UTC date, as the server sees it.
   *
   * The client must not compute this: the check-in window, the streak and
   * the measurement date are all UTC days decided server-side, and a phone
   * in another timezone would disagree by a day at the edges.
   */
  today: string;
  hasConsent: boolean;
  consentVersion: string;
  selections: ConditionId[];
  plan: DailyPlan;
  measurements: MeasurementSeries[];
  activeStake: ActiveStakeView | null;
  history: StakeHistoryView[];
  config: {
    stakeAmountUsdt: number;
    escrowAddress: string;
    usdtAddress: string;
    chainId: number;
    targetDays: number;
    windowDays: number;
  };
}

/** One kind's recorded history, oldest first, with its trend precomputed. */
export interface MeasurementSeries {
  kind: MeasurementKind;
  points: MeasurementPoint[];
  trend: Trend;
}

export interface ActiveStakeView {
  id: string;
  status: StakeRow['status'];
  amountUsdt: string;
  txHash: string;
  targetDays: number;
  windowDays: number;
  endsOn: string | null;
  checkinCount: number;
  checkinDates: string[];
  checkedInToday: boolean;
  dayIndex: number;
  /** Null when the end date cannot be read, so the UI shows a fallback. */
  daysRemaining: number | null;
  targetMet: boolean;
}

export interface StakeHistoryView {
  id: string;
  status: StakeRow['status'];
  amountUsdt: string;
  rewardUsdt: string;
  checkinCount: number;
  targetDays: number;
  targetMet: boolean;
  startedAt: string;
  endsOn: string | null;
  payoutTxHash: string | null;
}

/**
 * Groups measurement rows into one series per kind.
 *
 * numeric columns arrive from the driver as strings so no precision is lost
 * in transit. They are parsed here, once, at the edge; a row whose number
 * will not parse is dropped rather than becoming NaN in a chart.
 */
function toSeries(rows: MeasurementRow[]): MeasurementSeries[] {
  const byKind = new Map<MeasurementKind, MeasurementPoint[]>();

  for (const row of rows) {
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;

    const secondaryRaw =
      row.value_secondary === null ? null : Number(row.value_secondary);
    const valueSecondary =
      secondaryRaw !== null && Number.isFinite(secondaryRaw)
        ? secondaryRaw
        : null;

    const measuredOn = toIsoDate(row.measured_on);
    if (measuredOn === null) continue;

    const point: MeasurementPoint = {
      id: row.id,
      kind: row.kind,
      unit: row.unit,
      value,
      valueSecondary,
      measuredOn,
    };
    const existing = byKind.get(row.kind);
    if (existing) existing.push(point);
    else byKind.set(row.kind, [point]);
  }

  // repo returns them ordered by kind then date, so insertion order is
  // already stable and oldest-first within each kind.
  return [...byKind.entries()].map(([kind, points]) => ({
    kind,
    points,
    trend: describeTrend(points),
  }));
}

function todayUtc(): string {
  return todayIso();
}

export async function buildState(user: UserRow): Promise<AppState> {
  const [consent, selections, stake, history, measurementRows] =
    await Promise.all([
      hasActiveConsent(user.id),
      getSelections(user.id),
      getActiveStake(user.id),
      getStakeHistory(user.id),
      getMeasurements(user.id),
    ]);

  // A user who has withdrawn consent still gets a plan, just the baseline
  // one, so the app never shows an empty or broken screen.
  const effectiveSelections = consent ? selections : [];

  // Withdrawing consent deletes measurements outright, so there should be
  // nothing to hide here. Gating anyway means a row that somehow outlived
  // its consent is never rendered.
  const measurements = consent ? toSeries(measurementRows) : [];

  let activeStake: ActiveStakeView | null = null;
  let planDayIndex = calendarDayIndex();

  if (stake) {
    const dates = await getCheckinDates(stake.id);
    planDayIndex = dayIndexSince(new Date(stake.started_at));
    activeStake = {
      id: stake.id,
      status: stake.status,
      amountUsdt: formatUsdt(stake.amount_base),
      txHash: stake.stake_tx_hash,
      targetDays: stake.target_days,
      windowDays: stake.window_days,
      endsOn: toIsoDate(stake.ends_on),
      checkinCount: dates.length,
      checkinDates: dates,
      checkedInToday: dates.includes(todayUtc()),
      dayIndex: planDayIndex,
      daysRemaining: daysUntilInclusive(stake.ends_on),
      targetMet: dates.length >= stake.target_days,
    };
  }

  return {
    address: user.wallet_address,
    today: todayUtc(),
    hasConsent: consent,
    consentVersion: CONSENT_VERSION,
    selections: effectiveSelections,
    plan: getDailyPlan(effectiveSelections, planDayIndex),
    measurements,
    activeStake,
    history: history.map((row) => ({
      id: row.id,
      status: row.status,
      amountUsdt: formatUsdt(row.amount_base),
      rewardUsdt: formatUsdt(row.reward_base),
      checkinCount: row.checkin_count,
      targetDays: row.target_days,
      targetMet: row.target_met,
      startedAt: row.started_at,
      endsOn: toIsoDate(row.ends_on),
      payoutTxHash: row.payout_tx_hash,
    })),
    config: {
      stakeAmountUsdt: STAKE_AMOUNT_USDT,
      escrowAddress: ESCROW_WALLET_ADDRESS,
      usdtAddress: USDT_ADDRESS,
      chainId: CHAIN_ID,
      targetDays: TARGET_DAYS,
      windowDays: WINDOW_DAYS,
    },
  };
}
