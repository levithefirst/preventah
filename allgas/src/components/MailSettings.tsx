import { useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Me } from '../types';
import { guessTimezone } from '../session';

/**
 * Where the morning plan goes.
 *
 * Optional on purpose: the loop works entirely in the app, and mail is an
 * addition rather than the product. The manual send exists so a demo does
 * not have to wait for 07:00 local.
 */
export default function MailSettings({ me }: { me: Me }) {
  const setProfile = useMutation(api.members.setProfile);
  const sendNow = useAction(api.mail.sendMorningNow);
  const [email, setEmail] = useState(me.email ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section className="card">
      <h2>Morning plan by email</h2>
      <p className="muted">
        Two sends, both optional. The morning plan at 07:00 your local time, and a nudge at 19:00
        if the day before went by without a check-in.
      </p>

      <label>
        Email address
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </label>

      <p className="muted">Timezone: {me.timezone}</p>

      <button
        className="primary"
        onClick={() => {
          setStatus(null);
          void setProfile({
            memberId: me.memberId,
            email: email.trim() === '' ? null : email.trim(),
            timezone: guessTimezone(),
          }).then(() => setStatus('Saved.'));
        }}
      >
        Save
      </button>

      <button
        className="link"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setStatus(null);
          void sendNow({ memberId: me.memberId })
            .then((result) => setStatus(result.detail))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? 'Sending...' : 'Send me today’s plan now'}
      </button>

      {status && <p className="muted">{status}</p>}
    </section>
  );
}
