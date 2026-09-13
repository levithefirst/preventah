import type { Metadata } from 'next';
import { CtaRow, Section, SiteLayout } from '@/components/site/shared';
import { FAQ_ITEMS, Faq } from '@/components/site/sections';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'What Preventah is, whether you need Nimiq Pay, whether this is medical advice, how the USDT commitment works, and who sees your family history.',
};

export default function Page() {
  return (
    <SiteLayout>
      <Section
        as="h1"
        eyebrow="FAQ"
        title="Questions people ask."
        lede="If something here is still unclear, the answer is probably that Preventah does less than you expect, on purpose."
      >
        <Faq items={FAQ_ITEMS} />
        <div style={{ marginTop: 32 }}>
          <CtaRow />
        </div>
      </Section>
    </SiteLayout>
  );
}
