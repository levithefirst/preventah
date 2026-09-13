'use client';

import { useState } from 'react';
import Window from './ui/Window';
import Button from './ui/Button';

/**
 * Explicit consent gate.
 *
 * Nothing health-related is stored before this is accepted: the catalog is
 * not even rendered until consent exists, and the server refuses to write a
 * selection or a measurement without a matching consent row.
 *
 * The bar across the top is ink, not mint. Every other surface in the
 * product is allowed to be warm; this one is asking permission to hold
 * someone's family health history, and it should look like it knows that.
 * The geometry stays identical so it still belongs to the same product.
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
    <Window bar="Before we use health information" barTone="ink" offset size="roomy">
      <h2 style={{ marginBottom: 12 }}>
        You decide what Preventah keeps
      </h2>

      <p className="muted">
        Preventah builds your daily plan from conditions you pick from a fixed
        list, and can track measurements you choose to record. That is health
        information, so we ask first.
      </p>

      <h3 className="label" style={{ marginTop: 24, marginBottom: 8 }}>
        What we store
      </h3>
      <ul className="pv-consent-list">
        <li>
          The conditions you tick, as short codes such as{' '}
          <code>hypertension</code>. Nothing else about them.
        </li>
        <li>
          Any measurements you choose to record: a number, a unit and a date.
          Recording them is optional and you can delete any of them at any
          time.
        </li>
        <li>Your wallet address, your stake, and which days you checked in.</li>
      </ul>

      <h3 className="label" style={{ marginTop: 24, marginBottom: 8 }}>
        What we never ask for
      </h3>
      <ul className="pv-consent-list">
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
        <li>
          Anything from a wearable, a fitness tracker, Apple Health or Google
          Fit. Preventah connects to nothing. Every number here is one you
          typed.
        </li>
      </ul>

      <h3 className="label" style={{ marginTop: 24, marginBottom: 8 }}>
        Your control
      </h3>
      <ul className="pv-consent-list">
        <li>
          You can withdraw consent at any time from the bottom of the main
          screen. Your selections and measurements are deleted immediately
          when you do.
        </li>
        <li>
          Withdrawing consent never affects a commitment already running.
          Your stake is still returned and you can still check in.
        </li>
        <li>Your data is never sold, shared, or used to train anything.</li>
      </ul>

      <label className="pv-consent-confirm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>
          I consent to Preventah storing the conditions I select and any
          measurements I choose to record, so it can build my daily prevention
          plan and show me my progress.
        </span>
      </label>

      <Button
        variant="primary"
        offset
        disabled={!agreed}
        busy={busy}
        busyLabel="Saving"
        onClick={onAccept}
      >
        Agree and continue
      </Button>

      <p className="faint" style={{ marginTop: 14, textAlign: 'center' }}>
        Preventah does not diagnose, treat or prescribe.
        <br />
        Consent text version {consentVersion}
      </p>
    </Window>
  );
}
