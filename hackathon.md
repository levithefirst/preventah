# Hackathon log

- **Project:** Preventah All Gas
- **Event:** Convex All Gas Hackathon
- **What it does:** Gives a household three prevention actions a day at free, cheap and premium spend tiers, and shows every member's check-ins on a live board.
- **Live app:** https://qualified-hummingbird-614.convex.site
- **Repo:** https://github.com/levithefirst/preventah
- **Frontend:** Convex static hosting
- **Convex deployment:** https://qualified-hummingbird-614.convex.cloud
- **Components:** none
- **Convex features:** schema, tables, indexes, queries, mutations, actions, internal functions, HTTP actions, crons, realtime queries
- **Auth:** none
- **AI models:** gpt-5-nano, falling back to gpt-4.1-nano then gpt-4o-mini
- **Started:** 2026-09-19T17:58:00Z
- **Last updated:** 2026-09-20T17:54:00Z

## Log

### 2026-09-19 - working tree
Started the All Gas app in `allgas/` as Vite + React on Convex, separate from
the Nimiq Mini App that already lives in this repo. Ported the curated data
layer rather than rewriting it: the 117-entry condition catalog, the tagged
prevention content, and the pure plan resolver moved into `convex/lib/` from
`src/lib/` (originally commits 05f9613 and aeddafd). That resolver is
synchronous and total, so opening the app never waits on a network call.

### 2026-09-19 - working tree
Laid down the schema and the loop it backs (`convex/schema.ts`). Five tables:
households keyed by a six-character join code, members carrying consent state
and catalog ids, check-ins indexed by member/day and household/day, cached
source cards, and a mail log. Consent is a real gate: `conditionIds` stays
empty and `members.today` reports `needsConsent` until it is accepted.
Convex features: schema, tables, indexes.

### 2026-09-19 - working tree
Built the daily loop. `members.today` resolves the day's three actions and
marks which are already done; `lib/tiers.ts` derives free, cheap and premium
options per action, with the free tier always set to the action's own target
rather than a teaser. `checkins.check` recomputes the day's offer server-side
instead of trusting the client's action id, and re-checking an action swaps
the tier instead of double-counting. `households.board` is one subscribed
query, so a check-in on one phone reaches the rest of the household without a
poll. Convex features: queries, mutations, indexes, realtime queries.

### 2026-09-19 - working tree
Added Firecrawl source cards (`convex/sources.ts`). An action searches for
current public-health pages for a selected condition, filters results to an
allow-list of public-health domains, and caches them through an internal
mutation; the UI reads the cache from a live query. Degrades rather than
throws: a missing key, a refused call or an unparseable payload all leave the
cached cards in place and report why. Reads `FIRECRAWL_API_KEY` from the
deployment environment. Convex features: actions, internal mutations.

### 2026-09-19 - working tree
Added AgentMail sends and the crons that drive them (`convex/mail.ts`,
`convex/crons.ts`). A morning plan writes out the day's three actions and
their tiers; a nudge follows a day that went by without a check-in, worded to
stay gentle. Both claim a `mailLog` row before calling the API, so a retried
cron cannot mail twice. Both sweeps run hourly and filter on each member's
local clock, which serves several timezones from one cron instead of a job
per member. Reads `AGENTMAIL_API_KEY` and optionally `AGENTMAIL_INBOX_ID`
from the deployment environment; values are never in the repo. Convex
features: crons, internal actions, scheduled sweeps.

### 2026-09-19 - working tree
Put the frontend on the deployment itself. `scripts/embed-site.mjs` embeds the
Vite build into `convex/siteAssets.ts` and `convex/http.ts` serves it from the
HTTP router with an index fallback, so the SPA and its API share one origin on
`*.convex.site`. Fingerprinted assets are cached immutably, `index.html` is
not. Convex features: HTTP actions.

### 2026-09-19 - working tree
Wrote the screens: household create/join, the consent gate, the catalog picker
with category chips and search, today's three actions with tier buttons and an
expandable why/how, the live board, and the mail settings tab with a manual
send so a demo does not have to wait for 07:00. Added a smoke test over the
pure core (`allgas/tests/loop.test.ts`): a plan resolves for any input
including nonsense, the same selections and day always give the same plan,
every action offers all three tiers, and the sanitizer drops anything that is
not a catalog id. Ten tests pass. Writing that test caught a real bug:
`normalizeJoinCode` accepted `I` and `O`, which the code generator's alphabet
deliberately omits because they get misheard; it now strips them rather than
guessing at a substitution.

### 2026-09-19 - working tree
Not yet deployed. This session's network policy blocks every `convex.dev`
host, so `convex login`, `convex env set` and `convex deploy` could not run
from here. `convex/_generated/` was produced locally from the Convex CLI's own
codegen templates so the project typechecks and builds offline; `npx convex
dev` regenerates it. The frontend build is verified (`vite build`, 98 modules)
and `tsc --noEmit` is clean across `convex/` and `src/`.

### 2026-09-19 - 8961f9c
Live in production on Convex, which supersedes the "not yet deployed" note
above: that entry still describes the build environment, not the project. The
GitHub Actions workflow deployed backend and embedded site together, and the
app now answers on its `.convex.site` origin with the Convex deployment behind
it (`.github/workflows/allgas-deploy.yml`, `convex/http.ts`).

### 2026-09-20 - working tree
Added a wording layer over the catalog plan, not a replacement for it. One
OpenAI call per member per calendar day rewrites three titles, three one-line
hows and nine tier titles; ids, types, how-to lists, safety notes, costs and
every source stay exactly as the catalog has them (`convex/plansGenerate.ts`,
`convex/lib/openai.ts`, `convex/lib/rewrite.ts`). The day's row in the new
`dailyPlans` table is claimed in a transaction before the call goes out, so
the row is both the cache and the spend guard: tab changes, reloads and the
"Refresh wording" button all hit the table, and a second call for the same day
is impossible rather than merely unlikely.

Validation decides what is allowed through. A response is rejected whole if it
renames an id, reorders a tier, runs long, adds a URL the catalog did not
supply, or introduces a drug, dose, lab, supplement-as-treatment, diagnosis or
prediction. "Introduces" is defined against the catalog copy for that action,
so echoing a clinical word the catalog already used is fine and inventing one
is not. Any rejection, missing key, 401, 429, timeout or non-JSON body stores
`rewrite: "catalog"` and the catalog wording renders unchanged. There are no
retries; the model chain is walked only on a free 404 or parameter rejection.

Tests cover the parts that matter without a deployment (`allgas/tests/`): the
money rules against a stubbed fetch (one call per billable failure, the chain
advancing exactly once on a 404, the token ceiling), the safety rules
(invented drugs and doses rejected end to end), and a regression that walks
120 plan-days asserting the catalog's own wording always validates, so the
guard can never fail closed and quietly disable the layer. 40 tests pass, tsc
is clean and the build is green. The deployment's stored `model` field records
which model actually answered.
