import type { ReactNode } from 'react';
import Window from '../ui/Window';
import PlanGlyph from '../ui/PlanGlyph';
import type { PlanItemType } from '@/lib/plan-content';
import { STAKE_AMOUNT_USDT, TARGET_DAYS, WINDOW_DAYS } from '@/lib/config';

/**
 * Reusable public-site sections.
 *
 * Every claim here is restated from what the code actually does. A figure
 * appears on this page only when it can be read from somewhere the browser
 * is already allowed to see; otherwise the copy describes the rule. That is
 * what stops the marketing page quietly disagreeing with the product.
 *
 * Which side of that line each number falls on:
 *
 *  - The commitment amount, the target and the window are compiled into
 *    config.ts, which is client-safe by construction, so they are imported
 *    and rendered rather than typed out.
 *  - The reward rate is NOT. REWARD_BPS is read from the environment inside
 *    server-env.ts, which is guarded by `server-only`, so the browser has no
 *    honest way to know it. Printing "5%" here would be a literal that keeps
 *    claiming 5% after somebody changes the variable. So the reward is
 *    always described as fixed, never quoted.
 *  - The condition count stays a literal, because importing the catalog to
 *    render one number would ship all 117 entries to every visitor.
 */

/** See the note above: a literal on purpose, to keep the catalog off this page. */
export const CONDITION_COUNT_PUBLIC = 117;

/** Distinct `category` values in the catalog. Also a deliberate literal. */
export const CATEGORY_COUNT_PUBLIC = 13;

/** The most conditions one person can select. Mirrors MAX_SELECTIONS. */
export const MAX_SELECTIONS_PUBLIC = 15;

/**
 * The commitment, formatted the way a person reads it.
 *
 * Two decimals always, so it reads as money rather than as a bare number.
 */
export const STAKE_LABEL = `${STAKE_AMOUNT_USDT.toFixed(2)} USDT`;

/**
 * The four facts worth having above the fold.
 *
 * A list rather than a row of divs, because that is what it is: an
 * unordered set of claims. Screen readers announce the count, which is the
 * one thing a sighted visitor gets free from the layout.
 *
 * Nothing here is a testimonial, a user count or a rating. The product is
 * new and has none of those, and inventing them is the fastest way to lose
 * the only advantage an honest page has.
 */
export function ProofPills() {
  const facts = [
    `${CONDITION_COUNT_PUBLIC} conditions, ${CATEGORY_COUNT_PUBLIC} categories`,
    'Three items a day',
    `${STAKE_LABEL} on Polygon`,
    'Commitment returned either way',
  ];

  return (
    <ul className="pv-facts">
      {facts.map((fact) => (
        <li key={fact} className="pv-fact">
          {fact}
        </li>
      ))}
    </ul>
  );
}

/**
 * The commitment, as terms rather than prose.
 *
 * The amount is on the page on purpose. A commitment device that makes you
 * open the app to find out what it costs has already lost the argument it
 * is trying to make.
 */
export function CommitmentTerms() {
  const terms: { label: string; value: ReactNode }[] = [
    { label: 'You commit', value: `${STAKE_LABEL} on Polygon` },
    {
      label: 'The window',
      value: `Check in on ${TARGET_DAYS} days out of ${WINDOW_DAYS}`,
    },
    {
      label: `If you hit ${TARGET_DAYS} of ${WINDOW_DAYS}`,
      value: 'Your commitment back, plus a fixed reward',
    },
    {
      label: 'If you miss',
      value: 'Your commitment back in full. Only the reward is dropped.',
    },
    {
      label: 'Your keys',
      value: 'Stay in Nimiq Pay. Preventah never asks for a seed phrase.',
    },
  ];

  return (
    <dl className="pv-terms">
      {terms.map((term) => (
        <div key={term.label} className="pv-term">
          <dt>{term.label}</dt>
          <dd>{term.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WhatItIs({ headingAs: H = 'h3' }: { headingAs?: 'h2' | 'h3' }) {
  return (
    <div className="pv-grid pv-grid-3">
      <Window offset size="roomy">
        <span className="pv-step-num" aria-hidden="true">
          1
        </span>
        <H style={{ marginTop: 14 }}>Family history</H>
        <p className="muted" style={{ marginTop: 8 }}>
          Pick from a searchable catalog of {CONDITION_COUNT_PUBLIC}{' '}
          conditions. Everything is chosen from the list. There is no free-text
          box anywhere in the app, which is what keeps this from becoming a
          symptom checker.
        </p>
      </Window>

      <Window size="roomy">
        <span className="pv-step-num" aria-hidden="true">
          2
        </span>
        <H style={{ marginTop: 14 }}>A deterministic plan</H>
        <p className="muted" style={{ marginTop: 8 }}>
          One diet change, one bit of movement, one habit each day, resolved
          from a curated table. No model call, nothing generated at request
          time, and the same inputs always produce the same plan.
        </p>
      </Window>

      <Window size="roomy">
        <span className="pv-step-num" aria-hidden="true">
          3
        </span>
        <H style={{ marginTop: 14 }}>A reason to come back</H>
        <p className="muted" style={{ marginTop: 8 }}>
          A real USDT commitment on Polygon, approved in Nimiq Pay. Hit the
          target and it returns with a reward. Miss it and it still returns, in
          full.
        </p>
      </Window>
    </div>
  );
}

const STEPS = [
  {
    title: 'Open Preventah in Nimiq Pay',
    body: 'Your wallet proves who you are by signing a free message. No funds move, and Preventah never sees a key.',
  },
  {
    title: 'Read the consent screen',
    body: 'It lists exactly what is stored and what is never asked for. Nothing health-related is written until you tick the box.',
  },
  {
    title: 'Pick what runs in your family',
    body: `Search ${CONDITION_COUNT_PUBLIC} conditions across ${CATEGORY_COUNT_PUBLIC} categories and select up to ${MAX_SELECTIONS_PUBLIC}. Everything comes from the list, and each one explains what a family history of it does and does not mean.`,
  },
  {
    title: 'Get today’s plan',
    body: 'Three items, each of which explains why it is there, what to do, and where the guidance came from.',
  },
  {
    title: 'Commit, then mark today done',
    body: 'Approve the USDT transfer in Nimiq Pay. Then check in on the days you follow the plan. One check-in per day, enforced by the database.',
  },
  {
    title: 'Settlement runs on its own',
    body: 'A daily job returns commitments automatically. Hit the target and the reward comes with it. Miss it and the commitment still comes back in full.',
  },
];

export function HowItWorks({ headingAs: H = 'h3' }: { headingAs?: 'h2' | 'h3' }) {
  return (
    <ol className="pv-steps-list">
      {STEPS.map((step, index) => (
        <li key={step.title} className="pv-step">
          <span className="pv-step-num" aria-hidden="true">
            {index + 1}
          </span>
          <div>
            <H>{step.title}</H>
            <p className="muted" style={{ marginTop: 6 }}>
              {step.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * A static sample of the plan UI.
 *
 * Labelled EXAMPLE, and captioned as a structure rather than a plan, because
 * a marketing page showing plausible health guidance without that label is
 * how someone ends up following advice that was never resolved for them.
 */
export function PlanPreview() {
  const items: { type: PlanItemType; kind: string; title: string; why: string }[] = [
    {
      type: 'diet',
      kind: 'Diet',
      title: 'Keep added salt under one teaspoon all day.',
      why: 'From family history: High blood pressure',
    },
    {
      type: 'exercise',
      kind: 'Exercise',
      title: 'Walk for 15 minutes after your largest meal.',
      why: 'From family history: Type 2 diabetes',
    },
    {
      type: 'habit',
      kind: 'Habit',
      title: 'Measure your blood pressure and record it.',
      why: 'From family history: High blood pressure',
    },
  ];

  return (
    <>
      <Window
        bar="Your prevention plan"
        barNote="Example"
        offset
        className="pv-preview"
      >
        <ul className="pv-plan-list">
          {items.map((item) => (
            <li key={item.kind} className="pv-plan-item">
              <div className="pv-plan-trigger">
                <PlanGlyph type={item.type} />
                <span className="pv-plan-body">
                  <span className="pv-plan-kind">{item.kind}</span>
                  <span className="pv-plan-title">{item.title}</span>
                  <span className="pv-plan-why">{item.why}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Window>
      <p className="pv-sample-tag">
        Sample structure, not your plan. Real items are resolved from the
        conditions you select.
      </p>
    </>
  );
}

export function ProgressPreview() {
  return (
    <div className="pv-grid">
      <Window bar="Today" offset size="roomy">
        <div className="pv-streak-head">
          <span className="pv-stat">4</span>
          <div>
            <span className="label">of 5 days</span>
            <p className="faint" style={{ margin: 0 }}>
              Days you checked in.
            </p>
          </div>
        </div>
        <div className="pv-week" aria-hidden="true">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div
              key={`${day}-${i}`}
              className={`pv-day${i < 4 ? ' pv-day-done' : ''}${i === 4 ? ' pv-day-today' : ''}`}
            >
              {i < 4 ? '✓' : day}
            </div>
          ))}
        </div>
        <p className="faint" style={{ marginTop: 16 }}>
          Streak is showing up. Missing a day is cream, not red: it costs you
          nothing, because the commitment comes back either way.
        </p>
      </Window>

      <Window bar="Progress" size="roomy">
        <span className="label">Weight</span>
        <div className="pv-series-value amount" style={{ marginTop: 4 }}>
          82.4 kg
        </div>
        <svg
          className="pv-spark"
          viewBox="0 0 280 56"
          preserveAspectRatio="none"
          role="img"
          aria-label="An example weight trend over six readings"
        >
          <path
            d="M4,14 L59,20 L114,17 L169,30 L224,34 L276,40"
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="2"
          />
          <circle cx="276" cy="40" r="3" fill="var(--color-ink)" />
        </svg>
        <p className="faint">
          Down 1.8 kg across 6 readings, since 12 August.
        </p>
        <p className="faint" style={{ marginTop: 12 }}>
          Plan progress is what you finished. Preventah reports which way a
          number moved and never whether that is good. It sets no targets and
          grades no reading.
        </p>
      </Window>
    </div>
  );
}

export function SafetyList({ headingAs: H = 'h3' }: { headingAs?: 'h2' | 'h3' }) {
  return (
    <div className="pv-grid">
      <Window size="roomy">
        <H>What is stored</H>
        <ul className="pv-plain-list" style={{ marginTop: 12 }}>
          <li>Your wallet address.</li>
          <li>Which catalog conditions you ticked, as short codes.</li>
          <li>
            Any measurements you chose to record: a number, a unit and a date.
          </li>
          <li>Your commitment, and which days you checked in.</li>
        </ul>
      </Window>

      <Window size="roomy">
        <H>What is never asked for</H>
        <ul className="pv-plain-list" style={{ marginTop: 12 }}>
          <li>Your name, date of birth or email.</li>
          <li>
            Free-text symptoms or diagnoses. There is no text box anywhere in
            the app, and the database rejects anything that is not a catalog
            entry.
          </li>
          <li>Which relative, or any clinical detail.</li>
          <li>
            Anything from a wearable, Apple Health or Google Fit. Preventah
            connects to nothing. Every number in it is one you typed.
          </li>
        </ul>
      </Window>

      <Window offset size="roomy">
        <H>Consent comes first</H>
        <p className="muted" style={{ marginTop: 10 }}>
          Nothing health-related is written before you agree to it, and the
          server refuses the write rather than trusting the screen. Withdrawing
          consent deletes your selections and measurements immediately. The
          consent record itself is kept, marked revoked, as an audit trail.
        </p>
        <p className="muted">
          Withdrawing consent never affects a commitment already running. Your
          USDT is still returned and you can still check in.
        </p>
      </Window>

      <Window size="roomy">
        <H>Keys stay in Nimiq Pay</H>
        <p className="muted" style={{ marginTop: 10 }}>
          Preventah never asks for a private key or a seed phrase. There is no
          field for one and no code path that would accept one. Signing and
          payment happen entirely inside Nimiq Pay&rsquo;s own wallet UI.
        </p>
        <p className="faint" style={{ marginTop: 12 }}>
          Your data is never sold, shared, or used to train anything.
        </p>
      </Window>
    </div>
  );
}

export interface FaqItem {
  q: string;
  a: ReactNode;
}

/**
 * FAQ answers restate what the product does. Where a precise figure lives in
 * configuration, the answer names the rule rather than the number.
 */
export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'What is Preventah?',
    a: 'A Nimiq Pay Mini App that turns family health history into a clear daily prevention plan, then keeps you coming back with a real USDT commitment you approve yourself.',
  },
  {
    q: 'Do I need Nimiq Pay?',
    a: 'Yes. Preventah runs inside it. Nimiq Pay is a self-custodial payments app, which means you hold your own keys and approve every transfer.',
  },
  {
    q: 'Is this medical advice?',
    a: 'No. Preventah gives general lifestyle guidance of the kind found in public-health material. It does not diagnose, treat or prescribe, it does not score or predict your risk, and it does not replace a clinician.',
  },
  {
    q: 'What is the USDT commitment?',
    a: 'You transfer a small amount of USDT on Polygon at the start. Check in on five days out of seven and a daily settlement job returns it with a fixed reward on top. Miss the target and it is still returned in full: Preventah never keeps a deposit.',
  },
  {
    q: 'Is the reward a yield or an investment?',
    a: 'No. It is a fixed, funded rebate for keeping a habit: the same percentage for everyone, decided before you commit. Nothing about it is random and nothing about it depends on a market.',
  },
  {
    q: 'Who sees my family history?',
    a: 'Nobody but you. It is stored as short condition codes against your wallet address, never your name, and it is never sold, shared or used to train anything. Withdrawing consent deletes it immediately.',
  },
  {
    q: 'Can I use it without crypto knowledge?',
    a: 'Mostly. Nimiq Pay is the wallet and Preventah is the habit plan, so the only crypto step is approving one transfer in an app that asks you plainly. You will need some USDT on Polygon and a little POL for the network fee.',
  },
  {
    q: 'Does skipping a day mean I lose my money?',
    a: 'No. The target is five days out of seven, so there is room to miss. And even if you miss the target entirely, your commitment comes back in full. Only the reward depends on hitting it.',
  },
  {
    q: 'Can I use it without committing any USDT?',
    a: 'Yes, more of it than you might expect. Consent, picking what runs in your family, and your daily plan all work with no commitment at all. The commitment adds the part money is actually good at: a streak, and a reason to open the app on the day you would rather not.',
  },
];

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div style={{ marginTop: 24 }}>
      {items.map((item) => (
        // details/summary: native disclosure, keyboard-operable, works with
        // no JavaScript at all. No accordion library.
        <details key={item.q} className="pv-faq">
          <summary>{item.q}</summary>
          <div className="pv-faq-body">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
