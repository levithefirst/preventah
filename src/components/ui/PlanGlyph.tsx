import type { PlanItemType } from '@/lib/plan-content';

/**
 * The category glyph on a plan row.
 *
 * Deliberately not a tick box. There is no per-item completion in this
 * product: the daily check-in is one action covering the whole day, so a
 * checkbox here would be a control that looks tappable and does nothing.
 *
 * Drawn from the brand's own line vocabulary rather than a medical icon set:
 * a bowl, a path that continues off-frame, a calendar square. No organs, no
 * hearts, no ECG traces.
 *
 * Shared so the live plan and the static example on the public site cannot
 * drift apart.
 */
const PATHS: Record<PlanItemType, React.ReactNode> = {
  diet: (
    <>
      <path d="M4 11h12a6 6 0 0 1-12 0Z" />
      <path d="M10 11V4" />
    </>
  ),
  exercise: (
    <>
      <path d="M3 15c4 0 3-6 7-6s3 6 7 6" />
      <path d="m14 12 3 3-3 3" />
    </>
  ),
  habit: (
    <>
      <rect x="3.5" y="4.5" width="13" height="12" rx="2.5" />
      <path d="M3.5 8h13M7 3v3M13 3v3" />
    </>
  ),
};

export default function PlanGlyph({ type }: { type: PlanItemType }) {
  return (
    <span className="pv-glyph" aria-hidden="true">
      <svg
        viewBox="0 0 20 20"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[type]}
      </svg>
    </span>
  );
}
