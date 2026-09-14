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
2. **Pick what runs in your family** from a searchable catalog of 117
   conditions across 13 categories. Everything is chosen from the list;
   there is no free-text input anywhere in the app.
3. **Get today's plan**: one diet change, one piece of movement, one habit.
   Tap any of them for why it matters, what to do, what it may support, a
   target you could check tonight, and a source.
4. **Stake USDT** on Polygon through your Nimiq Pay wallet. Nimiq Pay shows
   its own native confirmation sheet.
5. **Check in daily.** Hit 5 check-ins out of 7 days and the daily settlement
   job returns your stake with a reward on top.
6. **Track what you like**, optionally: weight, waist, blood pressure,
   resting heart rate, blood glucose, sleep. Every number is one you typed.
7. **Set a daily reminder** as a calendar entry, with no OAuth and no
   notification permission.

**Miss the target and your stake is still returned in full.** Preventah never
keeps a deposit. The reward is the only thing at stake, which keeps this a
commitment device rather than anything resembling a wager. Nothing about the
outcome is random: the reward is a fixed 5% (`REWARD_BPS=500`), so a
successful 0.10 USDT commitment returns exactly 0.105 USDT.

The amount applies to **new** commitments only. A commitment already running
was priced when it was made and is settled against the amount recorded on its
own row; changing the default never reprices it.

## Custody, in plain terms

Be clear-eyed about this before staking anything:

- **Preventah never asks for a private key or a seed phrase.** There is no
  field for one, and no code path that would accept one. Signing and payment
  happen entirely inside Nimiq Pay's own wallet UI.
- **The escrow wallet is project-controlled and custodial.** While a
  commitment is running, your USDT sits in a wallet the project holds the key
  to. You are trusting the operator to return it.
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
| Commitment | 0.10 USDT for a new commitment, compiled in as `STAKE_AMOUNT_USDT` |
| Reward | 5%, fixed (`REWARD_BPS=500`) |
| Window | check in on 5 days out of 7 |

The transaction is a plain ERC-20 `transfer` built with viem and handed to
`eth_sendTransaction`. Nimiq Pay renders its own confirmation sheet; the app
never builds one, and never sees a key.

---

## How the guidance works

117 conditions share one curated body of prevention guidance, because
writing bespoke advice for each would be a content project with no end and
a great deal of near-duplicate copy in it.

The bridge is a small, closed tag vocabulary. A condition carries tags
(`diet-salt`, `activity`, `bone-strength`, `screening`…), a plan item
carries the same tags, and an item is shown when the two intersect. Nothing
in the catalog names a plan item and nothing in the content names a
condition, so adding a condition is a data change rather than a writing job.
Tests assert the vocabulary is fully covered from both directions.

Some conditions carry no dietary or exercise tag at all, an inherited
retinal condition for instance. Those fall back to general prevention rather
than inventing a connection that is not there.

What the app deliberately does **not** do:

- **No scoring, ranking or prediction.** Family-history relevance is used to
  word a sentence, never to compute a risk number. Nothing here tells you
  how likely you are to develop anything.
- **No live AI.** Resolving a plan is a pure function of your selections and
  the day index. There is no model call, nothing asynchronous, and the same
  inputs always produce the same plan on the server and in the browser.
- **No targets.** Measurement trends report which way a number moved and by
  how much. They never say whether that is good.
- **No diagnosis or treatment advice.** Several plan items carry a safety
  note telling the reader to skip them: waist measurement is the wrong habit
  to hand someone with a history of disordered eating, and fibre is not
  universally good for every gut.

Sources are authoritative public-health references (WHO, NHS, CDC,
MedlinePlus/NIH), given so a reader can go further, not as a citation for a
numeric claim, because the app makes no numeric claims.

---

## The Mini App icon

The tile Preventah shows in **Nimiq Pay's Mini Apps directory is not served
from this repository.** It comes from the `icon:` field of `submission.yaml`
in [`nimiq/miniappscompetition-submissions`](https://github.com/nimiq/miniappscompetition-submissions),
alongside `thumbnail:` and `screenshots:`, and is hosted by Nimiq. Nothing in
this codebase can change it: `@nimiq/mini-app-sdk` exposes only `init()`,
`getHostLanguage()`, `requestDeviceIdentifier()` and the wallet provider, with
no icon, manifest or registration API of any kind.

`public/icons/preventah-icon-1024.png` is generated for that submission.

What this repository *does* control is every other icon surface, and those
were the reason a generic globe was appearing: until recently the only icons
here were SVG, which native icon loaders generally cannot decode.

| Asset | Format | Used by |
| --- | --- | --- |
| `/favicon.svg` | SVG | Browser tabs. Drawn for 16-32px: no mint grid, heavier P |
| `/icons/icon-192.png`, `/icons/icon-512.png` | PNG | Web app manifest, launchers, host scrapers |
| `/icons/icon-maskable-512.png` | PNG | Maskable purpose; mark pulled into the safe circle |
| `/icons/apple-touch-icon.png` | PNG | iOS home screen, which does not accept SVG |
| `/icons/preventah-icon-1024.png` | PNG | The Nimiq Mini Apps submission |

All of them are rasterised from `public/brand/preventah-app-icon.svg`, which
is the single source of truth for the icon composition.

---

## Design system

Every surface in Preventah is the same shape: a cream sheet, a 2px ink edge,
a blush sheet one step behind it, and optionally a bar across the top. The app
icon is that shape, the plan item is that shape, the commitment card is that
shape. The brand and the product are one system rather than a skin over a
dashboard.

| Token | Value | Used for |
| --- | --- | --- |
| canvas | `#C9B6EA` | The page field, app and site alike |
| cream | `#F6F1E8` | Every surface |
| ink | `#141414` | Text and every edge |
| mint | `#B7D9C2` | Primary actions, and the bar that means *today* |
| blush | `#E8B4B8` | The offset plate, one step behind |

A few rules that are load-bearing rather than decorative:

- **The bar colour says what kind of screen you are on.** Mint for habits,
  ink for money and consent. The moment the app asks for real USDT looks
  different from the moment it asks about a walk.
- **The offset plate is rationed** to primary objects, two or three a screen.
  On every row it makes the page vibrate.
- **Nothing is colour-coded as a diagnosis.** Semantic colours are calm text
  colours on cream, used for process states like a pending transaction. No
  blood pressure reading and no family condition is ever painted as good or
  bad, and a missed day is cream rather than red.
- **Body text is never below 15px, and inputs are pinned at exactly 16px**,
  because below that iOS zooms the WebView on focus and strands the user in a
  magnified layout they cannot easily escape inside a Mini App.
- **Depth is the offset plate, not a shadow.** The one box-shadow in the
  system is a zero-blur one, which is how the plate is drawn.

Typography is Bricolage Grotesque on titles and Plus Jakarta Sans on body,
self-hosted by `next/font` at only the four weights actually used.

Motion is CSS only: an 80ms press, a 120ms chip fill, a 200ms disclosure.
`prefers-reduced-motion` turns all of it off. There is no animation library,
and no runtime dependency was added for the design at all.

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
- **Free-text health data is impossible to store.** Selections are a foreign
  key into a `conditions` table seeded from the catalog, so an arbitrary
  string is a constraint violation in Postgres itself rather than something
  application code has to remember to check. Measurements are constrained
  the same way: a fixed set of kinds and units, with a `CHECK` that keeps
  blood pressure the only paired reading and its systolic above its
  diastolic.
- **Health writes are consent-gated server-side.** Both the conditions route
  and the measurements route refuse to write without an active consent row
  for the current `CONSENT_VERSION`. The client cannot bypass this by
  skipping a screen.
- **Deletion is scoped inside the statement.** Removing a measurement is
  filtered by `user_id` in the `DELETE` itself, so a valid id belonging to
  someone else finds nothing rather than being checked and then trusted.

---

## Privacy

Preventah stores the minimum it needs to work:

- Your wallet address
- Which catalog conditions you ticked, as short codes
- Any measurements you chose to record: a number, a unit and a date
- Your stake, and which days you checked in

It never asks for your name, date of birth, email, symptoms, diagnoses, which
relative, or any clinical detail. Family history is a yes-or-no flag.

**Preventah connects to nothing.** No wearable, no fitness tracker, no Apple
Health, no Google Fit, no calendar account. Every number in the app is one
you typed, and the reminder is a calendar file your device opens, not an
integration with a token attached.

Withdrawing consent deletes your selections and measurements immediately; the
consent record itself is retained, marked revoked, as an audit trail. It never
affects a commitment already running: your stake is still returned and you can
still check in.

Preventah gives general lifestyle guidance, not medical advice. It does not
score, rank or predict anyone's risk, and it sets no targets.

---

## Running locally

```bash
npm install
cp .env.example .env.local     # then fill in real values locally
npm run db:init                # applies db/schema.sql
npm run dev
```

### Routes

| Route | What it is |
| --- | --- |
| `/` | The Mini App inside Nimiq Pay, the public home page outside it |
| `/how-it-works`, `/prevention`, `/privacy`, `/faq` | Public, static, no wallet needed |
| `/api/*` | Same-origin API, unchanged by the redesign |

`/` stays the Mini App mount because that URL is the registered Nimiq Pay
deeplink target. It decides at runtime: if the host handshake finds Nimiq Pay
it renders the app, and otherwise the visitor gets the site rather than a
connect button with no wallet behind it.

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
db/schema.sql                Postgres schema, idempotent
scripts/db-init.mjs          Schema, catalog sync and migration, all idempotent
public/brand/                Mark, mono mark and lockup as SVG
src/app/globals.css          Design tokens and the component system
src/components/brand/        The mark, inline and reusable
src/components/ui/           Window, Button, Field, Chip, Badge, Toast, States
src/components/site/         Public website sections and chrome
src/lib/condition-types.ts   Category and plan-tag vocabulary
src/lib/condition-catalog.ts 117 conditions with sources and plan tags
src/lib/condition-index.ts   Lookup and deterministic search
src/lib/conditions.ts        Selection validation at the trust boundary
src/lib/plan-content.ts      The curated guidance library, tagged not keyed
src/lib/plans.ts             Tag-intersection resolver, pure and total
src/lib/measurements.ts      Measurement kinds, units, ranges, validation
src/lib/ics.ts               Calendar reminder builder
src/lib/verify-rules.ts      Pure on-chain verification rules
src/lib/dates.ts             Total date helpers, never throw
src/lib/chain.ts             On-chain verification and payout
src/lib/session.ts           Wallet-signature auth
src/lib/repo.ts              Data access
src/lib/wallet.ts            Client-side Nimiq Pay + EVM integration
src/lib/api-client.ts        Total browser API client, never rejects
src/app/api/                 Route handlers
src/components/              UI
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
