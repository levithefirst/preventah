-- Preventah schema (Neon Postgres).
-- Idempotent: safe to run repeatedly against the same database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- users: one row per Polygon wallet address seen inside Nimiq Pay.
-- We store no name, email, or any other directly identifying field.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  text NOT NULL UNIQUE,           -- lowercased 0x address
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- consents: explicit, versioned, auditable record of health-data consent.
-- No condition_selections row may be written unless an active consent exists.
-- Withdrawal is recorded by setting revoked_at rather than deleting the row,
-- so the audit trail survives.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_version  text NOT NULL,
  granted_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz
);

CREATE INDEX IF NOT EXISTS consents_user_idx ON consents (user_id, granted_at DESC);

-- ---------------------------------------------------------------------------
-- conditions: the catalog of family-health conditions a user may select.
--
-- This table exists to give condition_selections something to point at. It
-- is not the source of truth: src/lib/condition-catalog.ts is, and
-- scripts/db-init.mjs syncs this table from it on every run. Storing name
-- and category here is purely so the database is readable on its own.
--
-- Rows are never deleted. An id that leaves the catalog is stamped with
-- retired_at instead, so a selection written months ago still resolves and
-- the foreign key below can never be orphaned.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conditions (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  category    text NOT NULL,
  retired_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conditions_category_idx ON conditions (category);

-- ---------------------------------------------------------------------------
-- condition_selections: the conditions a user has told us run in their
-- family.
--
-- category_key holds a conditions.id. The name is historical: it was a
-- six-value CHECK before the catalog existed, and renaming a live column
-- buys nothing worth the risk of an old deployment writing to it mid-flight.
--
-- The foreign key (added by scripts/db-init.mjs, which can seed conditions
-- first) is what keeps free-text health data structurally impossible here.
-- An arbitrary string is a constraint violation in Postgres itself, not
-- something application code has to remember to check.
--
-- UNIQUE (user_id, category_key) makes a duplicate selection a database
-- error rather than an application concern.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS condition_selections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_key  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_key)
);

-- ---------------------------------------------------------------------------
-- stakes: one USDT commitment per row.
-- amount_base and reward_base are integer base units (USDT has 6 decimals),
-- never floats, so no rounding error can touch a balance.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stakes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address    text NOT NULL,
  chain_id          integer NOT NULL,
  token_address     text NOT NULL,
  escrow_address    text NOT NULL,
  amount_base       bigint NOT NULL CHECK (amount_base > 0),
  stake_tx_hash     text NOT NULL UNIQUE,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN (
                      'pending',    -- tx submitted, not yet verified on-chain
                      'active',     -- verified, streak window running
                      'rejected',   -- tx could not be verified, no funds recorded
                      'settling',   -- payout claimed by the cron job
                      'completed',  -- payout broadcast successfully
                      'payout_failed'
                    )),
  target_days       integer NOT NULL CHECK (target_days > 0),
  window_days       integer NOT NULL CHECK (window_days >= target_days),
  started_at        timestamptz NOT NULL DEFAULT now(),
  ends_on           date NOT NULL,
  target_met        boolean NOT NULL DEFAULT false,
  reward_base       bigint NOT NULL DEFAULT 0 CHECK (reward_base >= 0),
  payout_tx_hash    text,
  payout_at         timestamptz,
  payout_error      text,
  payout_attempts   integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stakes_user_idx   ON stakes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stakes_status_idx ON stakes (status, ends_on);

-- A user may only have one stake in flight at a time. Partial unique index
-- keeps historical rows unconstrained while blocking a second live stake.
CREATE UNIQUE INDEX IF NOT EXISTS stakes_one_active_per_user
  ON stakes (user_id)
  WHERE status IN ('pending', 'active', 'settling');

-- ---------------------------------------------------------------------------
-- checkins: at most one per stake per calendar day (UTC).
-- The UNIQUE constraint is what makes the streak tamper-proof: a double
-- check-in is rejected by the database, not by application logic.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id      uuid NOT NULL REFERENCES stakes(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date  date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stake_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS checkins_stake_idx ON checkins (stake_id, checkin_date);

-- ---------------------------------------------------------------------------
-- auth_nonces: single-use challenges for wallet signature login.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce       text PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  used_at     timestamptz,
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_nonces_expiry_idx ON auth_nonces (expires_at);
