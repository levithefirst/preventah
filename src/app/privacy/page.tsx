import type { Metadata } from 'next';
import { CtaRow, Section, SiteLayout } from '@/components/site/shared';
import { SafetyList } from '@/components/site/sections';

export const metadata: Metadata = {
  title: 'Privacy and consent',
  description:
    'What Preventah stores, what it never asks for, and how withdrawing consent works. Consent comes first and nothing health-related is written until you agree.',
};

export default function Page() {
  return (
    <SiteLayout>
      <Section
        as="h1"
        eyebrow="Privacy"
        title="Consent first, and the minimum after that."
        lede="Preventah holds health information, so the rules about it are worth stating plainly rather than burying in a policy nobody reads."
      >
        <SafetyList />
      </Section>

      <Section
        tone="cream"
        eyebrow="In practice"
        title="How the guarantees are actually enforced."
        lede="Stating a privacy promise is easy. These are the mechanisms behind them."
      >
        <ul className="pv-plain-list" style={{ maxWidth: '70ch', fontSize: 16 }}>
          <li>
            <strong>Free-text health data cannot be stored.</strong> A selection
            is a foreign key into the condition catalog, so an arbitrary string
            is a constraint violation in the database itself rather than
            something the application has to remember to check.
          </li>
          <li>
            <strong>Health writes are consent-gated on the server.</strong> Both
            the conditions route and the measurements route refuse to write
            without an active consent record. Skipping a screen in the client
            does not bypass it.
          </li>
          <li>
            <strong>Wallet ownership is proved by signature.</strong> A
            single-use challenge is issued, signed in Nimiq Pay and verified
            server-side, so nobody can act against an address they do not hold.
          </li>
          <li>
            <strong>Withdrawal deletes immediately.</strong> Selections and
            measurements are removed outright. The consent record itself is kept
            and marked revoked, as an audit trail that the withdrawal happened.
          </li>
          <li>
            <strong>Withdrawal never costs you money.</strong> A running
            commitment stays checkable and is still returned. Consent covers
            health data, not your funds.
          </li>
        </ul>

        <div style={{ marginTop: 32 }}>
          <CtaRow />
        </div>
      </Section>
    </SiteLayout>
  );
}
