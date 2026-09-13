import type { Metadata } from 'next';
import { CtaRow, Section, SiteLayout } from '@/components/site/shared';
import { CONDITION_COUNT_PUBLIC } from '@/components/site/sections';
import Window from '@/components/ui/Window';

export const metadata: Metadata = {
  title: 'How plans are built',
  description:
    'How Preventah turns a family history into daily prevention guidance: a closed tag vocabulary, a curated content library, and no model call anywhere in the path.',
};

export default function Page() {
  return (
    <SiteLayout>
      <Section
        as="h1"
        eyebrow="Prevention"
        title="How a plan is built."
        lede={`Preventah holds a catalog of ${CONDITION_COUNT_PUBLIC} conditions and a curated library of prevention guidance. Neither one names the other. They meet through a small, closed vocabulary of tags.`}
      >
        <div className="pv-grid">
          <Window offset size="roomy">
            <h3>Conditions carry tags</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              High blood pressure carries <code>diet-salt</code>,{' '}
              <code>activity</code>, <code>weight</code>, <code>alcohol</code>,{' '}
              <code>sleep</code> and <code>stress</code>. The tags describe what
              is worth doing, never how likely anything is.
            </p>
          </Window>

          <Window size="roomy">
            <h3>Guidance carries the same tags</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              An item about keeping salt under a teaspoon carries{' '}
              <code>diet-salt</code>. When your tags and an item&rsquo;s tags
              overlap, you see the item. That is the whole matching rule.
            </p>
          </Window>
        </div>

        <div style={{ marginTop: 24 }}>
          <Window size="roomy">
            <h3>What this design buys</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              {CONDITION_COUNT_PUBLIC} conditions share one body of guidance,
              so adding a condition is a data change rather than a writing job,
              and nobody has to invent a bespoke paragraph about a condition
              they are not qualified to write about.
            </p>
            <p className="muted">
              Some conditions carry no dietary or exercise tag at all &mdash; an
              inherited retinal condition, for instance. Those fall back to
              general prevention rather than inventing a connection that is not
              there.
            </p>
          </Window>
        </div>
      </Section>

      <Section
        tone="cream"
        eyebrow="Boundaries"
        title="What Preventah refuses to do."
      >
        <div className="pv-grid">
          <Window size="roomy">
            <h3>No scoring or prediction</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              Family-history relevance is used to word a sentence, never to
              compute a risk number. Nothing tells you how likely you are to
              develop anything.
            </p>
          </Window>
          <Window size="roomy">
            <h3>No live AI</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              Resolving a plan is a pure function of your selections and the
              day. No model call, nothing asynchronous, and the same inputs
              always produce the same plan.
            </p>
          </Window>
          <Window size="roomy">
            <h3>No targets</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              Measurement trends report which way a number moved and by how
              much. They never say whether that is good, and no reading is ever
              colour-coded.
            </p>
          </Window>
          <Window size="roomy">
            <h3>No diagnosis or prescription</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              Several items carry a safety note telling you to skip them. Waist
              measurement is the wrong habit to hand someone with a history of
              disordered eating, and fibre is not universally good for every
              gut.
            </p>
          </Window>
        </div>
      </Section>

      <Section
        eyebrow="Sources"
        title="Where the guidance comes from."
        lede="Public-health references: the World Health Organization, the NHS, the CDC and MedlinePlus. They are given so you can read further, not as a citation for a numeric claim, because Preventah makes no numeric claims."
      >
        <CtaRow />
      </Section>
    </SiteLayout>
  );
}
