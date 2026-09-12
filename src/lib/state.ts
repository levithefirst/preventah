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
import type { ConditionKey } from './conditions';
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
  selections: ConditionKey[];
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
  endsOn: string;
  checkinCount: number;
  checkinDates: string[];
  checkedInToday: boolean;
  dayIndex: number;
  daysRemaining: number;
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
  endsOn: string;
  payoutTxHash: string | null;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days from today until `endsOn` inclusive. Never negative. */
function daysRemaining(endsOn: string): number {
  const end = Date.parse(`${endsOn}T00:00:00Z`);
  const today = Date.parse(`${todayUtc()}T00:00:00Z`);
  return Math.max(0, Math.round((end - today) / 86_400_000) + 1);
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
      endsOn: stake.ends_on,
      checkinCount: dates.length,
      checkinDates: dates,
      checkedInToday: dates.includes(todayUtc()),
      dayIndex: planDayIndex,
      daysRemaining: daysRemaining(stake.ends_on),
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
      endsOn: row.ends_on,
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
