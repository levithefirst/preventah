import {
  CATEGORY_COUNT_PUBLIC,
  CONDITION_COUNT_PUBLIC,
  CommitmentTerms,
  FAQ_ITEMS,
  Faq,
  HowItWorks,
  PlanPreview,
  ProgressPreview,
  ProofPills,
  SafetyList,
  STAKE_LABEL,
  WhatItIs,
} from './sections';
import { CtaRow, Section, SiteLayout } from './shared';
import Window from '../ui/Window';
import { Mark } from '../brand/Logo';

/**
 * The public home page.
 *
 * Rendered at "/" for anyone who opened the production URL outside Nimiq
 * Pay, and reused by the static marketing routes. The Mini App keeps "/"
 * because that URL is the registered deeplink target.
 *
 * Deliberately not on this page: any health-data intake, any wallet prompt,
 * any assistant, any token price. A visitor can read everything here and
 * decide, without giving the product anything first.
 */
export function SiteHome() {
  return (
    <SiteLayout>
      {/* --- Hero --- */}
      <div className="pv-hero">
        <div>
          <span className="pv-eyebrow">A Nimiq Pay Mini App</span>
          <h1>
            Something runs in your family. Get today&rsquo;s diet, walk and
            habit.
          </h1>
          <p className="pv-lede" style={{ marginTop: 16 }}>
            Pick what runs in your family from {CONDITION_COUNT_PUBLIC} catalog
            conditions. Preventah turns that into three specific things to do
            today, then you commit {STAKE_LABEL} in Nimiq Pay so you actually
            do them.
          </p>
          <CtaRow secondary={{ href: '#how-it-works', label: 'How it works' }} />
          <ProofPills />
          <p className="faint" style={{ marginTop: 16 }}>
            Preventah does not diagnose, treat, or prescribe. It does not
            replace a clinician.
          </p>
        </div>

        <Window bar="Preventah" offset size="roomy" className="pv-hero-window">
          <div className="pv-hero-mark">
            <Mark size={64} />
          </div>
          <h2 style={{ marginTop: 16 }}>
            Family history in. A daily plan out.
          </h2>
          <p className="muted" style={{ marginTop: 10 }}>
            Pick from {CONDITION_COUNT_PUBLIC} conditions across{' '}
            {CATEGORY_COUNT_PUBLIC} categories. Preventah turns what you know
            into one diet change, one bit of movement, and one habit each day.
          </p>
          <p className="faint" style={{ marginTop: 12 }}>
            No symptom checker. No risk score. No free-text box anywhere.
          </p>
        </Window>
      </div>

      {/* --- The problem --- */}
      <Section
        eyebrow="The problem"
        title="You already know it runs in the family. Knowing is not a routine."
        lede="People live with “Dad had it” and “it skipped a generation”, and then cook the same dinner. General fitness apps do not start from family history. A clinician is not in your pocket at 8pm on a Tuesday. Preventah is the small daily layer in between."
      />

      {/* --- What it is --- */}
      <Section
        tone="cream"
        eyebrow="What it is"
        title="Three parts, and none of them guess."
        lede="Preventah is a foresight habit product. It is not a clinic, not a tracker farm, and not a crypto casino."
      >
        <WhatItIs />
      </Section>

      {/* --- Why family history --- */}
      <Section
        id="why"
        eyebrow="Why family history"
        title="You cannot change it. You can stay ahead of it."
        lede="Family history is one of the inputs clinicians already use. It changes what is worth checking and when, not what you have. Preventah turns what you know into a checklist you can actually act on."
      >
        <div className="pv-grid pv-grid-3">
          <Window size="compact">
            <h3>It is a reason to look, not a verdict</h3>
            <p className="muted" style={{ marginTop: 8 }}>
              A condition running in your family raises the value of
              prevention and of a conversation with a clinician. It does not
              mean you will develop it.
            </p>
          </Window>
          <Window size="compact">
            <h3>Most of it is multifactorial</h3>
            <p className="muted" style={{ marginTop: 8 }}>
              Very little in the catalog is a simple inherited disorder.
              Families share genes, but they also share kitchens, schedules
              and habits.
            </p>
          </Window>
          <Window size="compact">
            <h3>Knowing it is useful to a clinician</h3>
            <p className="muted" style={{ marginTop: 8 }}>
              Almost nobody can recall this accurately under the time pressure
              of an appointment. Writing it down once is one of the plan items
              Preventah gives you.
            </p>
          </Window>
        </div>
      </Section>

      {/* --- How it works --- */}
      <Section
        id="how-it-works"
        tone="cream"
        eyebrow="How it works"
        title="Six steps, start to settlement."
      >
        <HowItWorks />
      </Section>

      {/* --- Plan preview --- */}
      <Section
        eyebrow="The plan"
        title="Every item explains itself."
        lede="Tap any item and it tells you why it is on your plan, what to do, what it may support, and where the guidance came from. The plan is resolved from a static table: the same selections and the same day always produce the same plan."
      >
        <PlanPreview />
      </Section>

      {/* --- Progress --- */}
      <Section
        tone="cream"
        eyebrow="Progress"
        title="Two different truths, both visible."
        lede="Showing up and following through are not the same thing, so Preventah never merges them into one score."
      >
        <ProgressPreview />
      </Section>

      {/* --- Commitment --- */}
      <Section
        id="commitment"
        eyebrow="The commitment"
        title="Money is the reason you come back tomorrow."
        lede="You commit a small amount of USDT. Check in on five days out of seven and it comes back with a fixed reward on top. Miss the target and it still comes back, in full."
      >
        <div className="pv-grid">
          <Window bar="Commitment" barTone="ink" offset size="roomy">
            {/*
              The terms first, as terms. Hiding what it costs until someone
              has installed a wallet is the behaviour this product exists to
              argue against, so the number goes on the page.
            */}
            <CommitmentTerms />
            <ul className="pv-plain-list" style={{ marginTop: 20 }}>
              <li>
                <strong>Your commitment is never kept.</strong> Preventah does
                not take deposits. The reward is the only thing at stake, which
                is what keeps this a commitment device rather than anything
                resembling a wager.
              </li>
              <li>
                <strong>Nothing about the outcome is random.</strong> The
                reward is a fixed percentage of your commitment, the same for
                everyone, and it is settled by a rule rather than by chance.
                There is no draw, no multiplier and no way to lose more by
                trying.
              </li>
              <li>
                <strong>You approve every transfer in Nimiq Pay.</strong>{' '}
                Preventah never asks for a private key or a seed phrase. There
                is no field for one and no code path that would accept one.
              </li>
            </ul>
          </Window>

          <Window size="roomy">
            <h3>Be clear-eyed about custody</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              While a commitment is running, your USDT sits in an escrow wallet
              the project holds the key to. You are trusting the operator to
              return it. That key lives only in the server environment, is read
              by one function, and is never logged or sent to a browser.
            </p>
            <p className="muted">
              Refunds and rewards are sent automatically by a daily job. They
              are not discretionary, but they do depend on that job running and
              on the escrow holding enough USDT and gas.
            </p>
            <p className="faint" style={{ marginTop: 12 }}>
              This is not an investment and there is no yield. The reward is a
              fixed, funded rebate for keeping a habit.
            </p>
          </Window>
        </div>
      </Section>

      {/* --- Safety and privacy --- */}
      <Section
        id="privacy"
        tone="cream"
        eyebrow="Safety and privacy"
        title="Consent first, and the minimum after that."
      >
        <SafetyList />
      </Section>

      {/* --- Nimiq Pay --- */}
      <Section
        id="nimiq-pay"
        eyebrow="Nimiq Pay"
        title="Preventah runs inside a wallet you already use."
        lede="Nimiq Pay is a self-custodial payments app: you hold your own keys, and you approve every transfer yourself. Preventah is one of its Mini Apps."
      >
        <ol className="pv-steps-list">
          <li className="pv-step">
            <span className="pv-step-num" aria-hidden="true">
              1
            </span>
            <div>
              <h3>Install Nimiq Pay</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Available for iOS and Android. You will need a small amount of
                USDT on Polygon to make a commitment, and a little POL for the
                network fee.
              </p>
            </div>
          </li>
          <li className="pv-step">
            <span className="pv-step-num" aria-hidden="true">
              2
            </span>
            <div>
              <h3>Open Mini Apps</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Mini Apps run inside Nimiq Pay. Your keys never leave it.
              </p>
            </div>
          </li>
          <li className="pv-step">
            <span className="pv-step-num" aria-hidden="true">
              3
            </span>
            <div>
              <h3>Choose Preventah</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Or tap the button below on a phone with Nimiq Pay installed.
              </p>
              <div style={{ marginTop: 16 }}>
                <CtaRow />
              </div>
            </div>
          </li>
        </ol>
      </Section>

      {/* --- FAQ --- */}
      <Section id="faq" tone="cream" eyebrow="FAQ" title="Questions people ask.">
        <Faq items={FAQ_ITEMS} />
      </Section>

      {/* --- Closing CTA --- */}
      <Section tone="deep">
        <Window bar="Get started" offset size="roomy" className="pv-cta-window">
          <h2>Ready to stay ahead?</h2>
          <p className="muted" style={{ marginTop: 10 }}>
            Preventah opens inside Nimiq Pay. Consent comes first, and nothing
            health-related is stored until you agree to it.
          </p>
          <CtaRow />
        </Window>
      </Section>
    </SiteLayout>
  );
}

export default SiteHome;
