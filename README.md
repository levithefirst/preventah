# Preventah

A [Nimiq Pay](https://nimiq.com) Mini App that turns your family health
history into a daily prevention habit, backed by a USDT commitment stake you
get back for showing up.

Built for the Nimiq Mini Apps Competition, Cycle II.

**Open it in Nimiq Pay:**
<https://nimpay.app/miniapps/open/preventah-nimiq.vercel.app>

Production: <https://preventah-nimiq.vercel.app>

---

## What it does

1. **Consent.** Before anything health-related is stored, you read exactly
   what is kept and tick a box. No silent collection.
2. **Pick your risk categories** from a fixed checklist of six hereditary
   conditions. There is no free-text input anywhere in the app.
3. **Get today's plan**: one diet change, one piece of movement, one habit,
   resolved from a static rules table keyed to your selections.
4. **Stake USDT** on Polygon through your Nimiq Pay wallet. Nimiq Pay shows
   its own native confirmation sheet.
5. **Check in daily.** Hit 5 check-ins out of 7 days and the daily settlement
   job returns your stake with a reward on top.

**Miss the target and your stake is still returned in full.** Preventah never
keeps a deposit. The reward is the only thing at stake, which keeps this a
commitment device rather than anything resembling a wager. Nothing about the
outcome is random: the reward is a fixed 5% (`REWARD_BPS=500`), so a
successful 0.10 USDT commitment returns exactly 0.105 USDT.

## Custody, in plain terms

Be clear-eyed about this before staking anything:

- **Preventah never asks for a private key or a seed phrase.** There is no
  field for one, and no code path that would accept one. Signing and payment
  happen entirely inside Nimiq Pay's own wallet UI.
- **The escrow wallet is project-controlled and custodial.** While a
  commitment is running, your 0.10 USDT sits in a wallet the project holds the
  key to. You are trusting the operator to return it.
- **That key lives only in Vercel's environment**, is read by one server-side
  function, and is never logged, returned in a response, or shipped to the
  browser.
- Refunds and rewards are sent automatically by a daily job. They are not
  discretionary, but they do depend on that job running and on the escrow
  holding enough USDT and POL for gas.

---

## How the Nimiq integration works

Nimiq Pay exposes two providers, and Preventah uses both for distinct jobs:

| Provider | Obtained via | Used for |
| --- | --- | --- |
| `window.nimiq` | `init()` from `@nimiq/mini-app-sdk` | Host handshake, confirming the app is running inside Nimiq Pay, reading the user's Nimiq account and host language |
| `window.ethereum` | Injected by Nimiq Pay for EVM chains | The USDT stake on Polygon, chain switching, and the login signature |

The wallet is not decorative: no plan can be committed to, no streak can
start, and no payout can happen without a real on-chain USDT transfer
confirmed from the user's Nimiq Pay wallet.

| | |
| --- | --- |
| Chain | Polygon PoS, chain id `137` (`0x89`) |
| Token | USDT (PoS), 6 decimals |
| Contract | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| Commitment | 0.10 USDT (`NEXT_PUBLIC_STAKE_AMOUNT_USDT`) |
| Reward | 5%, fixed (`REWARD_BPS=500`) |
| Window | check in on 5 days out of 7 |

The transaction is a plain ERC-20 `transfer` built with viem and handed to
`eth_sendTransaction`. Nimiq Pay renders its own confirmation sheet; the app
never builds one, and never sees a key.

---

## Security model

The app custodies real user funds, so a few things are deliberate:

- **Nothing from the client is trusted.** A stake is registered by
  transaction hash only. The amount, sender, recipient and token are all read
  back from Polygon in `verifyStakeTransaction` before a stake counts. An
  under-funded, reverted, or fabricated claim cannot create an active stake.
- **A transaction can only fund one stake**, enforced by a `UNIQUE` constraint
  on `stake_tx_hash`.
- **Wallet ownership is proved by signature.** A nonce is issued, signed with
  `personal_sign`, verified server-side, and consumed atomically so it cannot
  be replayed. Without this anyone could check in against another address.
- **Streaks are tamper-proof at the database level.** `UNIQUE (stake_id,
  checkin_date)` means a duplicate daily check-in is a database error, not an
  application concern.
- **Double payouts are impossible.** The settlement job flips rows to
  `settling` in the same statement that selects them, so two overlapping cron
  runs cannot pay the same stake twice.
- **`ESCROW_PRIVATE_KEY` is read in exactly one function**, is never logged or
  returned, and lives only in the Vercel dashboard. Modules that touch secrets
  import `server-only`, so a stray client import fails the build rather than
  shipping a key to the browser.
- **Free-text health data is impossible to store.** `category_key` is
  `CHECK`-constrained to the six supported keys in Postgres itself.

---

## Privacy

Preventah stores the minimum it needs to work:

- Your wallet address
- Which of the six categories you ticked, as short codes
- Your stake, and which days you checked in

It never asks for your name, date of birth, email, symptoms, diagnoses, which
relative, or any clinical detail. Family history is a yes-or-no flag.
Withdrawing consent deletes your selections immediately; the consent record
itself is retained, marked revoked, as an audit trail.

Preventah gives general lifestyle guidance, not medical advice.

---

## Running locally

```bash
npm install
cp .env.example .env.local     # then fill in real values locally
npm run db:init                # applies db/schema.sql
npm run dev
```

### Environment variables

Set these in the Vercel dashboard for a deployment. See `.env.example`.

| Name | Scope | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | server | Neon Postgres pooled connection string |
| `NEXT_PUBLIC_ESCROW_WALLET_ADDRESS` | client | Transfer recipient shown to the wallet |
| `ESCROW_WALLET_ADDRESS` | server | Same address, used to verify transfers |
| `ESCROW_PRIVATE_KEY` | **server only** | Signs refunds and rewards. Never commit this. |
| `CRON_SECRET` | server | Guards `/api/cron/payout` |
| `SESSION_SECRET` | server | Signs wallet-auth session cookies |
| `POLYGON_RPC_URL` | server | Reading receipts, broadcasting payouts |
| `NEXT_PUBLIC_STAKE_AMOUNT_USDT` | client | Stake size for new commitments, defaults to 0.10 |
| `REWARD_BPS` | server | Reward in basis points, defaults to 500 (5%) |

`ESCROW_PRIVATE_KEY` must never be prefixed with `NEXT_PUBLIC_` and must never
be written into a file in this repository.

### Tests

```bash
npm test        # plan table, date handling, on-chain verification rules
npm run typecheck
npm run build   # production build
```

---

## Project layout

```
db/schema.sql              Postgres schema, idempotent
src/lib/conditions.ts      The fixed six-category checklist
src/lib/plans.ts           Deterministic plan table, pure and total
src/lib/verify-rules.ts    Pure on-chain verification rules
src/lib/dates.ts           Total date helpers, never throw
src/lib/chain.ts           On-chain verification and payout
src/lib/session.ts         Wallet-signature auth
src/lib/repo.ts            Data access
src/lib/wallet.ts          Client-side Nimiq Pay + EVM integration
src/lib/api-client.ts      Total browser API client, never rejects
src/app/api/               Route handlers
src/components/            UI
```

---

## Operating the escrow wallet

The escrow wallet needs:

- Enough **USDT** to cover outstanding stakes plus rewards
- Enough **POL** for gas on every payout transaction

The settlement job refuses to broadcast a transfer the escrow cannot cover,
marking the stake for retry rather than burning gas on a transaction that
would revert. After five failed attempts a stake is parked in `payout_failed`
for a human to look at.

---

## License

MIT. See [LICENSE](./LICENSE).
