'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_REMINDER_HOUR, DEFAULT_REMINDER_MINUTE } from '@/lib/ics';
import Window from './ui/Window';
import Button, { ButtonLink } from './ui/Button';
import { Field, Input } from './ui/Field';

/**
 * Daily reminder.
 *
 * A calendar file, not a push notification and not a calendar integration.
 * Preventah asks for no notification permission, holds no OAuth token and
 * has no scope on anyone's calendar account.
 *
 * Why the primary action is a webcal:// link
 * ------------------------------------------
 * The previous version was `<a download href="/api/reminder.ics">`, which
 * does nothing at all inside the Nimiq Pay WebView on Android. That is not
 * a bug in the link: an Android WebView performs no downloads unless the
 * host app installs a DownloadListener, so both the `download` attribute
 * and a `Content-Disposition: attachment` response route into a code path
 * the host may simply not have implemented. The tap is swallowed silently.
 *
 * webcal:// sidesteps the download machinery entirely. A non-http scheme
 * reaches the WebView as a navigation it cannot handle itself, which hosts
 * pass to the operating system as an intent - the same mechanism that makes
 * mailto: and tel: work inside apps. Calendar apps on both platforms
 * register for webcal://, so the OS opens one.
 *
 * The https link and the copy action are kept as real fallbacks rather than
 * decoration: the endpoint is unauthenticated, so a URL pasted into any
 * browser genuinely returns the file.
 *
 * Nothing here reports success. The page cannot observe whether the OS
 * accepted the handoff, and a green tick that means "we opened a URL" would
 * be a lie the user only discovers when the reminder never fires.
 */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export default function ReminderCard() {
  const [time, setTime] = useState(
    `${pad(DEFAULT_REMINDER_HOUR)}:${pad(DEFAULT_REMINDER_MINUTE)}`,
  );
  // [absolute origin, bare host]. Both come from the live location rather
  // than a build-time constant: the absolute one keeps the scheme correct
  // everywhere including local development, and webcal:// needs the host on
  // its own because it replaces the scheme entirely.
  const [[origin, host], setLocation] = useState(['', '']);
  const [copied, setCopied] = useState(false);

  // window does not exist during the server render, so this runs after mount.
  useEffect(() => {
    setLocation([window.location.origin, window.location.host]);
  }, []);

  const [hourPart, minutePart] = time.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const usable = Number.isFinite(hour) && Number.isFinite(minute);

  const query = `hour=${usable ? hour : DEFAULT_REMINDER_HOUR}&minute=${
    usable ? minute : DEFAULT_REMINDER_MINUTE
  }`;
  const path = `/api/reminder.ics?${query}`;
  const absoluteUrl = origin ? `${origin}${path}` : path;
  const webcalUrl = host ? `webcal://${host}${path}` : path;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard is unavailable or blocked in this WebView. The link is
      // rendered below as selectable text, which is the fallback.
      setCopied(false);
    }
  }

  return (
    <Window bar="Reminder">
      <p className="muted" style={{ marginBottom: 16 }}>
        A repeating entry for your own calendar. Preventah asks for no
        notification permission and gets no access to your calendar account.
      </p>

      <Field label="Remind me at" htmlFor="reminder-time">
        <Input
          id="reminder-time"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
      </Field>

      <ButtonLink
        href={webcalUrl}
        variant="primary"
        offset
        className="pv-reminder-cta"
      >
        Add to calendar
      </ButtonLink>

      <details className="pv-reminder-alt">
        <summary>It didn&rsquo;t open my calendar</summary>
        <div className="pv-reminder-alt-body">
          <p className="faint">
            Some in-app browsers block both calendar links and downloads. Open
            the link in your normal browser instead and it will hand the file
            to your calendar app.
          </p>

          <div className="pv-btn-row" style={{ marginTop: 12 }}>
            <Button variant="secondary" onClick={copyLink}>
              {copied ? 'Link copied' : 'Copy link'}
            </Button>
            <ButtonLink href={path} variant="secondary">
              Open file
            </ButtonLink>
          </div>

          <p className="faint" style={{ marginTop: 12 }}>
            Or type it in by hand:
          </p>
          <code className="pv-tx-hash">{absoluteUrl}</code>
        </div>
      </details>

      <p className="faint" style={{ marginTop: 14 }}>
        The entry says &ldquo;Preventah check-in&rdquo; and nothing else. It
        contains no health information, no wallet address and no commitment
        details, because a calendar syncs to other devices and is sometimes
        shared.
      </p>
    </Window>
  );
}
