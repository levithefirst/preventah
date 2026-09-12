# Competition submission checklist

Tracking for the Nimiq Mini Apps Competition, Cycle II.
Deadline: **18 September 2026, 23:59 UTC**.

## Hard requirements

- [x] Built on `@nimiq/mini-app-sdk`, runs inside the Nimiq Pay WebView
- [x] Nimiq wallet and payment are core to the UX, not decorative
- [x] Supports USDT on Polygon
- [x] Public GitHub repository
- [x] MIT license at the repository root
- [x] No hardcoded secrets or private keys in the codebase or git history
- [x] Explicit consent screen before any hereditary or health selection is stored
- [x] No gambling or chance-based mechanics: the stake is always returned,
      only the reward depends on effort, and nothing is decided by chance
- [ ] **250-word written description** &mdash; TODO, to be written by the project
      owner at submission time. Not drafted here deliberately: it is the
      owner's pitch to make, not invented marketing copy.

## Deployment

- [ ] Neon database provisioned and schema applied
- [ ] Vercel project deployed
- [ ] Environment variables set in the Vercel dashboard, including
      `ESCROW_PRIVATE_KEY` (set directly by the owner, never committed)
- [ ] Escrow wallet funded with USDT and POL for gas
- [ ] Deeplink confirmed working:
      `https://nimpay.app/miniapps/open/[deployed-url]`
- [ ] Vercel Cron confirmed running the daily settlement job

## Promotion checklist (5 points)

- [ ] To be completed per the competition's published promotion requirements.
