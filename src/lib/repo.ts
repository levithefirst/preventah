import 'server-only';
import { db } from './db';
import { CONSENT_VERSION, TARGET_DAYS, WINDOW_DAYS } from './config';
import type { ConditionId } from './conditions';
import type { MeasurementKind, ValidMeasurement } from './measurements';

/**
 * Data access layer. Every function here takes already-validated input;
 * validation happens at the route boundary.
 *
 * Postgres bigint arrives over the wire as a string, so amounts are
 * converted with BigInt() at the edge of this module and never handled as
 * JavaScript numbers.
 */

export interface UserRow {
  id: string;
  wallet_address: string;
}

export async function getOrCreateUser(address: string): Promise<UserRow> {
  const sql = db();
  const wallet = address.toLowerCase();
  const rows = (await sql`
    INSERT INTO users (wallet_address)
    VALUES (${wallet})
    ON CONFLICT (wallet_address)
      DO UPDATE SET last_seen_at = now()
    RETURNING id, wallet_address
  `) as UserRow[];
  return rows[0];
}

// --------------------------------------------------------------------------
// Consent
// --------------------------------------------------------------------------

export async function hasActiveConsent(userId: string): Promise<boolean> {
  const sql = db();
  const rows = (await sql`
    SELECT 1 FROM consents
    WHERE user_id = ${userId}
      AND consent_version = ${CONSENT_VERSION}
      AND revoked_at IS NULL
    LIMIT 1
  `) as unknown[];
  return rows.length > 0;
}

export async function grantConsent(userId: string): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO consents (user_id, consent_version)
    VALUES (${userId}, ${CONSENT_VERSION})
  `;
}

/**
 * Withdraws consent and erases the health selections it covered.
 *
 * The consent record itself is kept (marked revoked) as an audit trail, but
 * the hereditary data the user withdrew consent for is deleted outright.
 */
export async function revokeConsentAndErase(userId: string): Promise<void> {
  const sql = db();
  await sql`
    UPDATE consents SET revoked_at = now()
    WHERE user_id = ${userId} AND revoked_at IS NULL
  `;
  await sql`DELETE FROM condition_selections WHERE user_id = ${userId}`;
  // Measurements are covered by the same consent, so they go with it.
  await sql`DELETE FROM health_measurements WHERE user_id = ${userId}`;
}

// --------------------------------------------------------------------------
// Condition selections
// --------------------------------------------------------------------------

export async function getSelections(userId: string): Promise<ConditionId[]> {
  const sql = db();
  const rows = (await sql`
    SELECT category_key FROM condition_selections WHERE user_id = ${userId}
  `) as { category_key: ConditionId }[];
  return rows.map((r) => r.category_key);
}

/** Replaces the user's selection set. Caller must have checked consent. */
export async function setSelections(
  userId: string,
  keys: readonly ConditionId[],
): Promise<void> {
  const sql = db();
  await sql`DELETE FROM condition_selections WHERE user_id = ${userId}`;
  if (keys.length === 0) return;
  // Unnest keeps this a single round trip regardless of how many were picked.
  await sql`
    INSERT INTO condition_selections (user_id, category_key)
    SELECT ${userId}::uuid, unnest(${keys as string[]}::text[])
    ON CONFLICT (user_id, category_key) DO NOTHING
  `;
}

// --------------------------------------------------------------------------
// Stakes
// --------------------------------------------------------------------------

export interface StakeRow {
  id: string;
  user_id: string;
  wallet_address: string;
  amount_base: bigint;
  reward_base: bigint;
  stake_tx_hash: string;
  status:
    | 'pending'
    | 'active'
    | 'rejected'
    | 'settling'
    | 'completed'
    | 'payout_failed';
  target_days: number;
  window_days: number;
  started_at: string;
  ends_on: string;
  target_met: boolean;
  payout_tx_hash: string | null;
  payout_at: string | null;
  payout_error: string | null;
  checkin_count: number;
}

interface RawStakeRow extends Omit<StakeRow, 'amount_base' | 'reward_base' | 'checkin_count'> {
  amount_base: string;
  reward_base: string;
  checkin_count: string | number | null;
}

function hydrate(row: RawStakeRow): StakeRow {
  return {
    ...row,
    amount_base: BigInt(row.amount_base),
    reward_base: BigInt(row.reward_base),
    checkin_count: Number(row.checkin_count ?? 0),
  };
}

const STAKE_SELECT = `
  s.id, s.user_id, s.wallet_address, s.amount_base, s.reward_base,
  s.stake_tx_hash, s.status, s.target_days, s.window_days,
  s.started_at, s.target_met,
  -- Cast to text here, exactly as getCheckinDates does for checkin_date.
  -- Left as a bare date column, the driver yields a Date object that JSON
  -- encodes to a full ISO timestamp, not the YYYY-MM-DD the client expects.
  to_char(s.ends_on, 'YYYY-MM-DD') AS ends_on,
  s.payout_tx_hash, s.payout_at, s.payout_error,
  (SELECT count(*) FROM checkins c WHERE c.stake_id = s.id) AS checkin_count
`;

/** The user's in-flight stake, if any. */
export async function getActiveStake(userId: string): Promise<StakeRow | null> {
  const sql = db();
  const rows = (await sql.query(
    `SELECT ${STAKE_SELECT} FROM stakes s
     WHERE s.user_id = $1 AND s.status IN ('pending', 'active', 'settling')
     ORDER BY s.created_at DESC LIMIT 1`,
    [userId],
  )) as RawStakeRow[];
  return rows.length ? hydrate(rows[0]) : null;
}

export async function getStakeById(id: string): Promise<StakeRow | null> {
  const sql = db();
  const rows = (await sql.query(
    `SELECT ${STAKE_SELECT} FROM stakes s WHERE s.id = $1`,
    [id],
  )) as RawStakeRow[];
  return rows.length ? hydrate(rows[0]) : null;
}

export async function getStakeHistory(userId: string): Promise<StakeRow[]> {
  const sql = db();
  const rows = (await sql.query(
    `SELECT ${STAKE_SELECT} FROM stakes s
     WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 20`,
    [userId],
  )) as RawStakeRow[];
  return rows.map(hydrate);
}

export async function createPendingStake(params: {
  userId: string;
  walletAddress: string;
  chainId: number;
  tokenAddress: string;
  escrowAddress: string;
  amountBase: bigint;
  txHash: string;
}): Promise<StakeRow> {
  const sql = db();
  const rows = (await sql.query(
    `INSERT INTO stakes (
       user_id, wallet_address, chain_id, token_address, escrow_address,
       amount_base, stake_tx_hash, target_days, window_days, ends_on
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
             (now() AT TIME ZONE 'utc')::date + $10::int)
     RETURNING id`,
    [
      params.userId,
      params.walletAddress.toLowerCase(),
      params.chainId,
      params.tokenAddress.toLowerCase(),
      params.escrowAddress.toLowerCase(),
      params.amountBase.toString(),
      params.txHash.toLowerCase(),
      TARGET_DAYS,
      WINDOW_DAYS,
      WINDOW_DAYS - 1,
    ],
  )) as { id: string }[];
  const stake = await getStakeById(rows[0].id);
  if (!stake) throw new Error('Stake disappeared immediately after insert');
  return stake;
}

export async function findStakeByTxHash(txHash: string): Promise<StakeRow | null> {
  const sql = db();
  const rows = (await sql.query(
    `SELECT ${STAKE_SELECT} FROM stakes s WHERE s.stake_tx_hash = $1`,
    [txHash.toLowerCase()],
  )) as RawStakeRow[];
  return rows.length ? hydrate(rows[0]) : null;
}

/**
 * Promotes a verified stake to active. The status guard in the WHERE clause
 * makes this safe to call twice (a retry, or two tabs) without restarting
 * the streak window.
 */
export async function activateStake(
  stakeId: string,
  confirmedAmountBase: bigint,
): Promise<void> {
  const sql = db();
  await sql`
    UPDATE stakes
       SET status = 'active',
           amount_base = ${confirmedAmountBase.toString()}::bigint,
           started_at = now(),
           ends_on = (now() AT TIME ZONE 'utc')::date + ${WINDOW_DAYS - 1}::int,
           updated_at = now()
     WHERE id = ${stakeId}::uuid AND status = 'pending'
  `;
}

export async function rejectStake(stakeId: string, reason: string): Promise<void> {
  const sql = db();
  await sql`
    UPDATE stakes
       SET status = 'rejected', payout_error = ${reason.slice(0, 500)},
           updated_at = now()
     WHERE id = ${stakeId}::uuid AND status = 'pending'
  `;
}

// --------------------------------------------------------------------------
// Check-ins
// --------------------------------------------------------------------------

export async function getCheckinDates(stakeId: string): Promise<string[]> {
  const sql = db();
  const rows = (await sql`
    SELECT to_char(checkin_date, 'YYYY-MM-DD') AS d
      FROM checkins WHERE stake_id = ${stakeId}
     ORDER BY checkin_date
  `) as { d: string }[];
  return rows.map((r) => r.d);
}

/** Why a check-in attempt did or did not produce a row. */
export type CheckinOutcome =
  | 'recorded'
  | 'already_checked_in'
  | 'outside_window';

/**
 * Records today's check-in, bounded to the commitment window.
 *
 * The window bound lives inside the INSERT so it is evaluated atomically
 * with the write. A stake stays 'active' until the daily settlement job
 * runs, which can be up to 24 hours after its window closes; without this
 * bound a check-in in that gap would still count toward target_days and
 * convert a missed window into a paid reward.
 *
 * Duplicate protection remains the UNIQUE (stake_id, checkin_date)
 * constraint rather than a read-then-write.
 */
export async function addCheckin(
  stakeId: string,
  userId: string,
): Promise<CheckinOutcome> {
  const sql = db();

  const inserted = (await sql`
    INSERT INTO checkins (stake_id, user_id, checkin_date)
    SELECT s.id, s.user_id, (now() AT TIME ZONE 'utc')::date
      FROM stakes s
     WHERE s.id = ${stakeId}::uuid
       AND s.user_id = ${userId}::uuid
       AND s.status = 'active'
       AND (now() AT TIME ZONE 'utc')::date >= (s.started_at AT TIME ZONE 'utc')::date
       AND (now() AT TIME ZONE 'utc')::date <= s.ends_on
    ON CONFLICT (stake_id, checkin_date) DO NOTHING
    RETURNING id
  `) as { id: string }[];

  if (inserted.length > 0) return 'recorded';

  // No row written: either today is already recorded, or the attempt fell
  // outside the window. Distinguish so the user gets an accurate message.
  const existing = (await sql`
    SELECT 1 FROM checkins
     WHERE stake_id = ${stakeId}::uuid
       AND checkin_date = (now() AT TIME ZONE 'utc')::date
     LIMIT 1
  `) as unknown[];

  return existing.length > 0 ? 'already_checked_in' : 'outside_window';
}

// --------------------------------------------------------------------------
// Payout job queries
// --------------------------------------------------------------------------

/**
 * Atomically claims stakes that are ready to settle, flipping them to
 * 'settling' in the same statement that selects them.
 *
 * This is what stops two overlapping cron invocations from paying the same
 * stake twice: the second invocation's UPDATE matches no rows.
 */
export async function claimSettlableStakes(limit: number): Promise<StakeRow[]> {
  const sql = db();
  const rows = (await sql.query(
    `WITH ready AS (
       SELECT s.id,
              (SELECT count(*) FROM checkins c WHERE c.stake_id = s.id) AS hits
         FROM stakes s
        WHERE s.status = 'active'
     ),
     claimable AS (
       SELECT r.id FROM ready r
         JOIN stakes s ON s.id = r.id
        WHERE r.hits >= s.target_days
           OR s.ends_on < (now() AT TIME ZONE 'utc')::date
        ORDER BY s.created_at
        LIMIT $1
     )
     UPDATE stakes s
        SET status = 'settling',
            target_met = (
              SELECT count(*) FROM checkins c WHERE c.stake_id = s.id
            ) >= s.target_days,
            updated_at = now()
       FROM claimable
      WHERE s.id = claimable.id AND s.status = 'active'
      RETURNING s.id`,
    [limit],
  )) as { id: string }[];

  const stakes: StakeRow[] = [];
  for (const { id } of rows) {
    const stake = await getStakeById(id);
    if (stake) stakes.push(stake);
  }
  return stakes;
}

export async function markStakePaid(
  stakeId: string,
  payoutTxHash: string,
  rewardBase: bigint,
): Promise<void> {
  const sql = db();
  await sql`
    UPDATE stakes
       SET status = 'completed',
           payout_tx_hash = ${payoutTxHash},
           reward_base = ${rewardBase.toString()}::bigint,
           payout_at = now(),
           payout_error = NULL,
           updated_at = now()
     WHERE id = ${stakeId}::uuid
  `;
}

/**
 * Records a failed payout and hands the stake back to the next run.
 * After repeated failures the stake stops being retried automatically and
 * is left in payout_failed for a human to look at.
 */
export async function markPayoutFailed(
  stakeId: string,
  error: string,
): Promise<void> {
  const sql = db();
  await sql`
    UPDATE stakes
       SET payout_attempts = payout_attempts + 1,
           payout_error = ${error.slice(0, 500)},
           status = CASE WHEN payout_attempts + 1 >= 5
                         THEN 'payout_failed' ELSE 'active' END,
           updated_at = now()
     WHERE id = ${stakeId}::uuid
  `;
}

/** Stakes still waiting for on-chain confirmation, for the cron sweeper. */
export async function getPendingStakes(limit: number): Promise<StakeRow[]> {
  const sql = db();
  const rows = (await sql.query(
    `SELECT ${STAKE_SELECT} FROM stakes s
      WHERE s.status = 'pending' ORDER BY s.created_at LIMIT $1`,
    [limit],
  )) as RawStakeRow[];
  return rows.map(hydrate);
}

// --------------------------------------------------------------------------
// Health measurements
// --------------------------------------------------------------------------

/**
 * How much history is kept in the state payload.
 *
 * Six kinds at 90 points each is the worst case, and the chart only has a
 * few hundred pixels of width, so more than this would be paid for on every
 * page load and never drawn.
 */
export const MEASUREMENT_HISTORY_DAYS = 90;

export interface MeasurementRow {
  id: string;
  kind: MeasurementKind;
  unit: string;
  value: string;
  value_secondary: string | null;
  measured_on: string;
}

/**
 * Records one measurement, replacing that day's entry if there is one.
 *
 * Caller must have checked consent. Input must already have passed
 * validateMeasurement; the database CHECK constraints are a backstop, not
 * the validation.
 */
export async function recordMeasurement(
  userId: string,
  input: ValidMeasurement,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO health_measurements
      (user_id, kind, unit, value, value_secondary, measured_on)
    VALUES (
      ${userId}::uuid,
      ${input.kind},
      ${input.unit},
      ${input.value},
      ${input.valueSecondary},
      ${input.measuredOn}::date
    )
    ON CONFLICT (user_id, kind, measured_on) DO UPDATE
      SET unit            = EXCLUDED.unit,
          value           = EXCLUDED.value,
          value_secondary = EXCLUDED.value_secondary,
          updated_at      = now()
  `;
}

/**
 * A user's recent measurements, oldest first.
 *
 * measured_on is cast to text here for the same reason STAKE_SELECT does it:
 * left as a bare date column the driver yields a Date object, which JSON
 * encodes to a full ISO timestamp rather than the YYYY-MM-DD the client
 * expects. That mismatch has crashed this app's render once already.
 */
export async function getMeasurements(
  userId: string,
): Promise<MeasurementRow[]> {
  const sql = db();
  return (await sql`
    SELECT id,
           kind,
           unit,
           value::text                        AS value,
           value_secondary::text              AS value_secondary,
           to_char(measured_on, 'YYYY-MM-DD') AS measured_on
      FROM health_measurements
     WHERE user_id = ${userId}::uuid
       AND measured_on >= (now() AT TIME ZONE 'utc')::date
                          - ${MEASUREMENT_HISTORY_DAYS}::integer
     ORDER BY kind, measured_on ASC
  `) as MeasurementRow[];
}

/** Deletes one of the user's own measurements. Returns false if it was not theirs. */
export async function deleteMeasurement(
  userId: string,
  measurementId: string,
): Promise<boolean> {
  const sql = db();
  const rows = (await sql`
    DELETE FROM health_measurements
     WHERE id = ${measurementId}::uuid
       AND user_id = ${userId}::uuid
    RETURNING id
  `) as unknown[];
  return rows.length > 0;
}

/** Deletes every measurement a user holds, without touching consent. */
export async function deleteAllMeasurements(userId: string): Promise<void> {
  const sql = db();
  await sql`DELETE FROM health_measurements WHERE user_id = ${userId}::uuid`;
}
