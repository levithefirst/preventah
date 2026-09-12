'use client';

import { useState } from 'react';

/**
 * Explicit consent gate.
 *
 * Nothing health-related is stored before this is accepted: the checklist
 * is not even rendered until consent exists, and the server refuses to
 * write a selection without a matching consent row. The button stays
 * disabled until the box is ticked, so consent is never implied by
 * simply continuing.
 */
export default function ConsentCard({
  consentVersion,
  busy,
  onAccept,
}: {
  consentVersion: string;
  busy: boolean;
  onAccept: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Before we start</h2>
        <span className="badge">Step 1 of 2</span>
      </div>

      <p className="muted">
        Preventah builds your daily plan from hereditary risk categories you
        pick from a fixed list. That is health information, so we ask first.
      </p>

      <h3 style={{ marginTop: 16, marginBottom: 8 }}>What we store</h3>
      <ul className="consent-list">
        <li>
          The risk categories you tick, as short codes such as{' '}
          <code>hypertension</code>. Nothing else.
        </li>
        <li>Your wallet address, your stake, and which days you checked in.</li>
      </ul>

      <h3 style={{ marginTop: 16, marginBottom: 8 }}>What we never ask for</h3>
      <ul className="consent-list">
        <li>
          Your name, date of birth, email, or anything that identifies you
          personally.
        </li>
        <li>
          Free-text symptoms or diagnoses. There is no text box anywhere in
          this app, by design.
        </li>
        <li>
          Which relative, which diagnosis, or any clinical detail. Family
          history is a yes-or-no flag.
        </li>
      </ul>

      <h3 style={{ marginTop: 16, marginBottom: 8 }}>Your control</h3>
      <ul className="consent-list">
        <li>
          You can withdraw consent at any time from the bottom of the main
          screen. Your selections are deleted immediately when you do.
        </li>
        <li>Your data is never sold, shared, or used to train anything.</li>
      </ul>

      <label className="consent-confirm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>
          I consent to Preventah storing the risk categories I select, so it
          can build my daily prevention plan.
        </span>
      </label>

      <button
        type="button"
        className="btn btn-primary"
        disabled={!agreed || busy}
        onClick={onAccept}
      >
        {busy ? <span className="spinner" /> : null}
        {busy ? 'Saving' : 'I consent, continue'}
      </button>

      <p className="faint" style={{ marginTop: 12, textAlign: 'center' }}>
        Consent text version {consentVersion}
      </p>
    </section>
  );
}
