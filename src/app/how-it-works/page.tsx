import type { Metadata } from 'next';
import { CtaRow, Section, SiteLayout } from '@/components/site/shared';
import { HowItWorks, PlanPreview, ProgressPreview } from '@/components/site/sections';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Family history in, a deterministic prevention plan out, and a real USDT commitment as the reason to come back tomorrow. Six steps, start to settlement.',
};

/**
 * Server-rendered so it is crawlable and paints instantly.
 *
 * The Mini App lives at "/" because that is the registered Nimiq Pay
 * deeplink target, and "/" decides between the app and the site at runtime.
 * These routes carry the same content as real HTML for anyone, and anything,
 * that arrives without JavaScript.
 */
export default function Page() {
  return (
    <SiteLayout>
      <Section
        as="h1"
        eyebrow="How it works"
        title="Six steps, start to settlement."
        lede="Nothing here is generated at request time. The plan is resolved from a curated table, the streak is counted in the database, and the settlement runs on a schedule."
      >
        <HowItWorks headingAs="h2" />
        <div style={{ marginTop: 32 }}>
          <CtaRow />
        </div>
      </Section>

      <Section
        tone="cream"
        eyebrow="The plan"
        title="Every item explains itself."
        lede="Tap any item and it tells you why it is on your plan, what to do, what it may support, and where the guidance came from."
      >
        <PlanPreview />
      </Section>

      <Section
        eyebrow="Progress"
        title="Two different truths, both visible."
        lede="Showing up and following through are not the same thing, so Preventah never merges them into one score."
      >
        <ProgressPreview />
      </Section>
    </SiteLayout>
  );
}
