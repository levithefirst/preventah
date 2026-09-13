import 'server-only';
import { db } from './db';
import { CONSENT_VERSION, TARGET_DAYS, WINDOW_DAYS } from './config';
import type { ConditionKey } from './conditions';

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
}

// --------------------------------------------------------------------------
// Condition selections
// --------------------------------------------------------------------------

export async function getSelections(userId: string): Promise<ConditionKey[]> {
  const sql = db();
  const rows = (await sql`
    SELECT category_key FROM condition_selections WHERE user_id = ${userId}
  `) as { category_key: ConditionKey }[];
  return rows.map((r) => r.category_key);
}

/** Replaces the user's selection set. Caller must have checked consent. */
export async function setSelections(
  userId: string,
  keys: readonly ConditionKey[],
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

/**
 * Records today's check-in.
 * Returns false when one already existed for today; the UNIQUE constraint,
 * not application logic, is what enforces that.
 */
export async function addCheckin(
  stakeId: string,
  userId: string,
): Promise<boolean> {
  const sql = db();
  const rows = (await sql`
    INSERT INTO checkins (stake_id, user_id, checkin_date)
    VALUES (${stakeId}::uuid, ${userId}::uuid, (now() AT TIME ZONE 'utc')::date)
    ON CONFLICT (stake_id, checkin_date) DO NOTHING
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
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
