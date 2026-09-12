# Competition submission checklist

Nimiq Mini Apps Competition, Cycle II.
Deadline: **18 September 2026, 23:59 UTC**.

## Hard requirements

- [x] Built on `@nimiq/mini-app-sdk`, runs inside the Nimiq Pay WebView
- [x] Nimiq wallet and payment are core to the UX, not decorative
- [x] Supports USDT on Polygon
- [x] Public GitHub repository
- [x] MIT license at the repository root
- [x] No hardcoded secrets or private keys in the codebase or git history
- [x] Explicit consent screen before any hereditary selection is stored
- [x] No gambling or chance-based mechanics: the stake is always returned,
      only the reward depends on effort, and nothing is decided by chance
- [ ] **250-word written description** &mdash; TODO for the project owner.
      Deliberately not drafted here: it is the owner's pitch to make.

## Verified

Checks actually run, with their results:

- `npm run build` passes, both with and without environment variables set
  (every secret is read lazily at request time, so a missing variable never
  breaks the build)
- `npm test` passes 9/9, including all 63 category subsets across 366 days
  (23,058 plan resolutions) with no failure and no non-determinism
- The client bundle contains none of `ESCROW_PRIVATE_KEY`, `CRON_SECRET`,
  `SESSION_SECRET`, `DATABASE_URL` or `POLYGON_RPC_URL`; only the four
  intended `NEXT_PUBLIC_` values are present
- Git history contains no key material
- Every data route returns 401 without a session cookie
- Schema applied to the Neon project `preventah` (`long-cell-02605301`);
  constraints verified by attempting to violate them. A free-text insert
  into `condition_selections` is rejected by Postgres itself:
  `violates check constraint "condition_selections_category_key_check"`

## Not yet verified

- **The deployed URL has not been confirmed responding.** A preview
  deployment was created at
  `https://preventah-nimiq-h3ayukknk-levithefirst-1227s-projects.vercel.app`,
  but this build environment blocks outbound requests to `*.vercel.app`, and
  the Vercel token used here can create deployments without being able to
  read them back. Confirm it in a browser before relying on it.
- The end-to-end wallet flow, which needs Nimiq Pay and a funded escrow
- The deeplink

## Remaining setup

1. Set environment variables in the Vercel dashboard (see `.env.example`).
   `ESCROW_PRIVATE_KEY` is set there directly and never committed.
2. **Redeploy after setting them.** `NEXT_PUBLIC_*` values are baked in at
   build time, so the escrow address will not reach the client until a
   rebuild.
3. Connect the GitHub repository in the Vercel project's Git settings, so
   pushes deploy automatically. This failed from here because Vercel's
   GitHub app does not currently have access to `levithefirst/preventah`.
4. Fund the escrow wallet with USDT and with POL for gas.
5. Confirm the deeplink: `https://nimpay.app/miniapps/open/[deployed-url]`
6. Confirm Vercel Cron is running the daily settlement job.
7. Delete the throwaway Vercel projects created while working around a
   deployment permission error: `preventah-permcheck`, `preventah-app`, and
   an empty `preventah`. The live one is `preventah-nimiq`.

## Promotion checklist (5 points)

- [ ] To be completed per the competition's published promotion requirements.
