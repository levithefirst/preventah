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
import { calendarDayIndex, dayIndexSince, getDailyPlan, type DailyPlan } from './plans';
import {
  getActiveStake,
  getCheckinDates,
  getSelections,
  getStakeHistory,
  hasActiveConsent,
  type StakeRow,
  type UserRow,
} from './repo';

/** The single payload the client renders from. */
export interface AppState {
  address: string;
  hasConsent: boolean;
  consentVersion: string;
  selections: ConditionId[];
  plan: DailyPlan;
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

function todayUtc(): string {
  return todayIso();
}

export async function buildState(user: UserRow): Promise<AppState> {
  const [consent, selections, stake, history] = await Promise.all([
    hasActiveConsent(user.id),
    getSelections(user.id),
    getActiveStake(user.id),
    getStakeHistory(user.id),
  ]);

  // A user who has withdrawn consent still gets a plan, just the baseline
  // one, so the app never shows an empty or broken screen.
  const effectiveSelections = consent ? selections : [];

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
    hasConsent: consent,
    consentVersion: CONSENT_VERSION,
    selections: effectiveSelections,
    plan: getDailyPlan(effectiveSelections, planDayIndex),
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
