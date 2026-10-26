<div align="center">

<img src="public/brand/preventah-lockup.svg" alt="Preventah" width="320">

### Turn your family health history into a daily prevention habit.

A [Nimiq Pay](https://nimiq.com) Mini App. Pick what runs in your family, get one small diet, movement and habit change a day, and back it with a USDT commitment you always get back, plus a reward for showing up.

[Live site](https://preventah-nimiq.vercel.app) · [How it works](https://preventah-nimiq.vercel.app/how-it-works) · [Privacy](https://preventah-nimiq.vercel.app/privacy) · [FAQ](https://preventah-nimiq.vercel.app/faq)

[![License: MIT](https://img.shields.io/badge/license-MIT-B7D9C2)](./LICENSE)
![Next.js 16](https://img.shields.io/badge/Next.js-16-141414)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![Polygon USDT](https://img.shields.io/badge/stake-USDT%20on%20Polygon-8247E5)
![Neon Postgres](https://img.shields.io/badge/db-Neon%20Postgres-00E599)

</div>

> [!NOTE]
> Built for the **Nimiq Mini Apps Competition, Cycle II**. Preventah gives general lifestyle guidance, not medical advice. It never scores, ranks or predicts anyone's risk.

---

## Contents

- [Why Preventah](#why-preventah)
- [How it works for a user](#how-it-works-for-a-user)
- [The commitment](#the-commitment)
- [Custody, in plain terms](#custody-in-plain-terms)
- [Architecture](#architecture)
- [Nimiq integration](#nimiq-integration)
- [How the guidance works](#how-the-guidance-works)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Commands and tests](#commands-and-tests)
- [API routes](#api-routes)
- [Security model](#security-model)
- [Privacy](#privacy)
- [Design system](#design-system)
- [Project layout](#project-layout)
- [Operating the escrow wallet](#operating-the-escrow-wallet)
- [License](#license)

---

## Why Preventah

Knowing that heart disease or type 2 diabetes runs in your family is useful only if it changes what you do on a normal Tuesday. Most people get the warning and nothing else.

Preventah closes that gap with three ideas:

| | |
| --- | --- |
| **Small, specific actions** | One diet change, one piece of movement and one habit per day, each with why it matters, what to do, and a source. |
| **A commitment device** | A small USDT stake from your Nimiq Pay wallet. Show up 5 days out of 7 and it comes back with a fixed 5% reward. Miss the target and it still comes back in full. |
| **Nothing creepy** | Explicit consent first, no free text anywhere, no wearables, no risk scores, no AI. |

---

## How it works for a user

1. **Consent.** Before anything health-related is stored, you read exactly what is kept and tick a box.
2. **Pick what runs in your family** from a searchable catalog of **117 conditions across 13 categories**. Everything is chosen from the list; there is no free-text input anywhere in the app.
3. **Get today's plan**: one diet change, one piece of movement, one habit. Tap any of them for why it matters, what to do, what it may support, a target you could check tonight, and a source.
4. **Stake USDT** on Polygon through your Nimiq Pay wallet. Nimiq Pay shows its own native confirmation sheet.
5. **Check in daily.** Hit 5 check-ins out of 7 days and the daily settlement job returns your stake with a reward on top.
6. **Track what you like**, optionally: weight, waist, blood pressure, resting heart rate, blood glucose, sleep. Every number is one you typed.
7. **Set a daily reminder** as a calendar (`.ics`) entry, with no OAuth and no notification permission.

`/` is the Mini App when opened inside Nimiq Pay and the public website everywhere else. It decides at runtime: if the host handshake finds Nimiq Pay it renders the app; otherwise the visitor gets the site rather than a connect button with no wallet behind it.

---

## The commitment

| | |
| --- | --- |
| Chain | Polygon PoS, chain id `137` (`0x89`) |
| Token | USDT (PoS), 6 decimals |
| Contract | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| Amount | **0.10 USDT** for a new commitment, compiled in as `STAKE_AMOUNT_USDT` in `src/lib/config.ts` |
| Reward | 5%, fixed (`REWARD_BPS=500` by default) |
| Window | Check in on 5 separate days inside a 7-day window |
| Settlement | Vercel Cron calls `/api/cron/payout` daily at 02:00 UTC |

**Miss the target and your stake is still returned in full.** Preventah never keeps a deposit. The reward is the only thing that depends on effort, and nothing is decided by chance, which keeps this a commitment device rather than anything resembling a wager. A successful 0.10 USDT commitment returns exactly 0.105 USDT.

The amount applies to **new** commitments only. A running commitment is settled against the amount recorded on its own row, so changing the default never reprices it.

---

## Custody, in plain terms

> [!WARNING]
> Be clear-eyed about this before staking anything.

- **Preventah never asks for a private key or a seed phrase.** There is no field for one and no code path that would accept one. Signing and payment happen entirely inside Nimiq Pay's own wallet UI.
- **The escrow wallet is project-controlled and custodial.** While a commitment is running, your USDT sits in a wallet the project holds the key to. You are trusting the operator to return it.
- **That key lives only in the deployment's environment**, is read by one server-side function, and is never logged, returned in a response, or shipped to the browser.
- **Refunds and rewards are sent automatically** by the daily job. They are not discretionary, but they depend on that job running and on the escrow holding enough USDT, and POL for gas.

---

## Architecture

```text
Nimiq Pay (WebView)
  │  window.nimiq     → host handshake, account, language
  │  window.ethereum  → Polygon chain switch, personal_sign login, USDT transfer
  ↓
Next.js 16 app  (React 19, App Router)
  │  /            Mini App inside Nimiq Pay, public site outside it
  │  /api/*       same-origin route handlers, wallet-signature sessions
  ↓
Neon Postgres  ← consent, condition selections, measurements, stakes, check-ins
  ↑
Vercel Cron → /api/cron/payout (daily)
  ↓
Polygon RPC (viem) → verify stake receipts, send refund + reward from escrow
```

---

## Nimiq integration

Nimiq Pay exposes two providers, and Preventah uses both for distinct jobs:

| Provider | Obtained via | Used for |
| --- | --- | --- |
| `window.nimiq` | `init()` from `@nimiq/mini-app-sdk` | Host handshake, confirming the app is running inside Nimiq Pay, reading the user's Nimiq account and host language |
| `window.ethereum` | Injected by Nimiq Pay for EVM chains | The USDT stake on Polygon, chain switching, and the login signature |

The wallet is not decorative: no plan can be committed to, no streak can start, and no payout can happen without a real on-chain USDT transfer confirmed from the user's Nimiq Pay wallet.

The stake is a plain ERC-20 `transfer` built with viem and handed to `eth_sendTransaction`. Nimiq Pay renders its own confirmation sheet; the app never builds one and never sees a key.

---

## How the guidance works

117 conditions share one curated body of prevention guidance, because bespoke advice per condition would be endless near-duplicate copy.

The bridge is a small, closed **tag vocabulary**. A condition carries tags (`diet-salt`, `activity`, `bone-strength`, `screening`…), a plan item carries the same tags, and an item is shown when the two intersect. Nothing in the catalog names a plan item and nothing in the content names a condition, so adding a condition is a data change rather than a writing job. Tests assert the vocabulary is fully covered from both directions.

Conditions with no dietary or exercise tag (an inherited retinal condition, for instance) fall back to general prevention rather than inventing a connection that is not there.

What the app deliberately does **not** do:

- **No scoring, ranking or prediction.** Family-history relevance words a sentence; it never computes a risk number.
- **No live AI.** A plan is a pure function of your selections and the day index. Same inputs, same plan, on the server and in the browser.
- **No targets.** Measurement trends report which way a number moved and by how much, never whether that is good.
- **No diagnosis or treatment advice.** Some plan items carry a safety note telling the reader to skip them: waist measurement is the wrong habit for someone with a history of disordered eating, and fibre is not universally good for every gut.

Sources are public-health references (WHO, NHS, CDC, MedlinePlus/NIH), given so a reader can go further.

---

## Getting started

**Requirements:** Node.js 20+ to run the app (Node 22 or newer to run the test suite, which relies on Node's built-in TypeScript stripping), and a Postgres database (the project targets [Neon](https://neon.tech)).

```bash
git clone https://github.com/levithefirst/preventah.git
cd preventah
npm install
cp .env.example .env.local     # then fill in real values locally
npm run db:init                # applies db/schema.sql and syncs the condition catalog
npm run dev
```

Open <http://localhost:3000>. Outside Nimiq Pay you will see the public site; the wallet flow only runs inside the Nimiq Pay WebView.

> [!TIP]
> `npm run build` succeeds with no environment variables set. Every secret is read lazily at request time.

---

## Configuration

See [`.env.example`](./.env.example). For a deployment, set these in the hosting dashboard.

| Name | Scope | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | server | Neon Postgres pooled connection string |
| `NEXT_PUBLIC_ESCROW_WALLET_ADDRESS` | client | Escrow address used as the transfer recipient |
| `ESCROW_WALLET_ADDRESS` | server | Same address, used to verify incoming transfers |
| `ESCROW_PRIVATE_KEY` | **server only** | Signs refunds and rewards. Never commit it, never prefix it with `NEXT_PUBLIC_`. |
| `CRON_SECRET` | server | Guards `/api/cron/payout` (sent by Vercel Cron as the `Authorization` header) |
| `SESSION_SECRET` | server | Signs wallet-auth session cookies |
| `POLYGON_RPC_URL` | server | Reading receipts and broadcasting payouts |
| `REWARD_BPS` | server, optional | Reward in basis points, 0–10000, default `500` (5%) |
| `NEXT_PUBLIC_CHAIN_ID` | client, optional | Defaults to `137` (Polygon) |
| `NEXT_PUBLIC_USDT_ADDRESS` | client, optional | Defaults to USDT on Polygon mainnet |

`NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them. The stake amount is deliberately **not** an environment variable; it is compiled in so any change shows up in a diff.

---

## Commands and tests

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:init` | Apply the schema, sync the catalog and run migrations (idempotent; reads `.env.local`) |
| `npm test` | Node test runner over `tests/*.test.mjs` |

The test suite covers the plan resolver, the condition catalog and tag vocabulary, date handling, measurements, calendar reminders, the API client and the on-chain verification rules.

---

## API routes

All routes are same-origin under `/api`. Data routes require a wallet-signature session cookie.

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/auth/nonce` | `POST` | Issue a single-use login nonce |
| `/api/auth/verify` | `POST` | Verify the `personal_sign` signature and start a session |
| `/api/me` | `GET` | Current user state: consent, selections, stake, check-ins |
| `/api/consent` | `POST`, `DELETE` | Give or withdraw consent |
| `/api/conditions` | `POST` | Save condition selections (consent-gated) |
| `/api/measurements` | `POST`, `DELETE` | Add or remove a measurement (consent-gated) |
| `/api/stake` | `POST` | Register a stake by transaction hash |
| `/api/stake/verify` | `POST` | Re-check a pending stake on-chain |
| `/api/checkin` | `POST` | Today's check-in |
| `/api/reminder.ics` | `GET` | Daily reminder as a calendar file |
| `/api/cron/payout` | `GET`, `POST` | Settlement job, guarded by `CRON_SECRET` |

Public pages: `/how-it-works`, `/prevention`, `/privacy`, `/faq`.

---

## Security model

The app custodies real user funds, so a few things are deliberate:

- **Nothing from the client is trusted.** A stake is registered by transaction hash only. Amount, sender, recipient and token are read back from Polygon in `verifyStakeTransaction` before a stake counts.
- **A transaction can fund only one stake**, enforced by a `UNIQUE` constraint on `stake_tx_hash`.
- **Wallet ownership is proved by signature.** A nonce is issued, signed with `personal_sign`, verified server-side and consumed atomically so it cannot be replayed.
- **Streaks are tamper-proof in the database.** `UNIQUE (stake_id, checkin_date)` makes a duplicate daily check-in a database error.
- **No double payouts.** The settlement job flips rows to `settling` in the same statement that selects them, so overlapping cron runs cannot pay the same stake twice.
- **`ESCROW_PRIVATE_KEY` is read in exactly one function.** Modules that touch secrets import `server-only`, so a stray client import fails the build.
- **Free-text health data is impossible to store.** Selections are a foreign key into a `conditions` table seeded from the catalog. Measurements use a fixed set of kinds and units, with a `CHECK` keeping blood pressure the only paired reading and its systolic above its diastolic.
- **Health writes are consent-gated server-side** against the current `CONSENT_VERSION`. Skipping a screen in the client does not bypass it.
- **Deletion is scoped inside the statement.** Removing a measurement filters by `user_id` in the `DELETE` itself.

---

## Privacy

Preventah stores the minimum it needs:

- Your wallet address
- Which catalog conditions you ticked, as short codes
- Any measurements you chose to record: a number, a unit and a date
- Your stake, and which days you checked in

It never asks for your name, date of birth, email, symptoms, diagnoses, which relative, or any clinical detail. Family history is a yes-or-no flag.

**Preventah connects to nothing.** No wearable, fitness tracker, Apple Health, Google Fit or calendar account. The reminder is a calendar file your device opens, not an integration with a token attached.

Withdrawing consent deletes your selections and measurements immediately; the consent record itself is kept, marked revoked, as an audit trail. It never affects a running commitment: your stake is still returned and you can still check in.

---

## Design system

Every surface is the same shape: a cream sheet, a 2px ink edge, a blush sheet one step behind it, and optionally a bar across the top. The app icon, the plan item and the commitment card are all that shape, so the brand and the product are one system.

| Token | Value | Used for |
| --- | --- | --- |
| canvas | `#C9B6EA` | The page field |
| cream | `#F6F1E8` | Every surface |
| ink | `#141414` | Text and every edge |
| mint | `#B7D9C2` | Primary actions, and the bar that means *today* |
| blush | `#E8B4B8` | The offset plate |

Load-bearing rules:

- **The bar colour says what kind of screen you are on.** Mint for habits, ink for money and consent.
- **Nothing is colour-coded as a diagnosis.** No reading or condition is painted good or bad, and a missed day is cream, not red.
- **Body text is never below 15px and inputs are exactly 16px**, because below that iOS zooms the WebView on focus.
- **Motion is CSS only** (80ms press, 120ms chip fill, 200ms disclosure) and `prefers-reduced-motion` turns it off.

Typography is Bricolage Grotesque for titles and Plus Jakarta Sans for body, self-hosted by `next/font`.

<details>
<summary><strong>Icons and the Nimiq directory tile</strong></summary>

The tile in Nimiq Pay's Mini Apps directory is **not served from this repository**. It comes from the `icon:` field of `submission.yaml` in [`nimiq/miniappscompetition-submissions`](https://github.com/nimiq/miniappscompetition-submissions) and is hosted by Nimiq.

Every other icon surface is controlled here, all rasterised from `public/brand/preventah-app-icon.svg`:

| Asset | Format | Used by |
| --- | --- | --- |
| `/favicon.svg` | SVG | Browser tabs |
| `/icons/icon-192.png`, `/icons/icon-512.png` | PNG | Web app manifest, launchers |
| `/icons/icon-maskable-512.png` | PNG | Maskable purpose |
| `/icons/apple-touch-icon.png` | PNG | iOS home screen |
| `/icons/preventah-icon-1024.png` | PNG | The Mini Apps submission |
| `/icons/thumbnail-240.png` | PNG | The submission thumbnail |

</details>

---

## Project layout

```text
db/schema.sql                Postgres schema, idempotent
scripts/db-init.mjs          Schema, catalog sync and migration, all idempotent
public/brand/                Mark, mono mark and lockup as SVG
src/app/                     Pages, manifest and API route handlers
src/components/              Mini App UI, public site sections, UI kit
src/lib/condition-catalog.ts 117 conditions with sources and plan tags
src/lib/plan-content.ts      The curated guidance library, tagged not keyed
src/lib/plans.ts             Tag-intersection resolver, pure and total
src/lib/measurements.ts      Measurement kinds, units, ranges, validation
src/lib/verify-rules.ts      Pure on-chain verification rules
src/lib/chain.ts             On-chain verification and payout
src/lib/session.ts           Wallet-signature auth
src/lib/wallet.ts            Client-side Nimiq Pay + EVM integration
src/lib/config.ts            Stake amount, window, consent version
tests/                       Node test runner suites
vercel.json                  Daily payout cron
```

---

## Operating the escrow wallet

The escrow wallet needs enough **USDT** to cover outstanding stakes plus rewards, and enough **POL** for gas on every payout.

The settlement job refuses to broadcast a transfer the escrow cannot cover, marking the stake for retry instead of burning gas on a transaction that would revert. After five failed attempts a stake is parked in `payout_failed` for a human to look at.

---

## License

MIT. See [LICENSE](./LICENSE).
