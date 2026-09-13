'use client';

import { useState } from 'react';
import {
  DEFAULT_REMINDER_HOUR,
  DEFAULT_REMINDER_MINUTE,
} from '@/lib/ics';

/**
 * Daily reminder.
 *
 * A calendar file, not a push notification and not a Google Calendar
 * integration. Preventah asks for no notification permission, holds no
 * OAuth token and has no scope on anyone's calendar account: the browser
 * fetches a text/calendar file and the operating system opens it in
 * whichever calendar app the user already has.
 *
 * The time is sent as a query parameter and interpreted as local time by
 * whatever device renders the event, so nothing about a timezone is stored.
 */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export default function ReminderCard() {
  const [time, setTime] = useState(
    `${pad(DEFAULT_REMINDER_HOUR)}:${pad(DEFAULT_REMINDER_MINUTE)}`,
  );

  const [hourPart, minutePart] = time.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const usable = Number.isFinite(hour) && Number.isFinite(minute);

  const href = `/api/reminder.ics?hour=${usable ? hour : DEFAULT_REMINDER_HOUR}&minute=${usable ? minute : DEFAULT_REMINDER_MINUTE}`;

  return (
    <section className="card">
      <div className="card-head">
        <h2>Daily reminder</h2>
      </div>

      <p className="muted" style={{ marginBottom: 12 }}>
        A repeating entry for your own calendar. Preventah asks for no
        notification permission and gets no access to your calendar account.
      </p>

      <label className="field-label" htmlFor="reminder-time">
        Remind me at
      </label>
      <div className="measure-row">
        <input
          id="reminder-time"
          className="measure-input"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
        <a className="btn btn-secondary reminder-btn" href={href} download>
          Add to calendar
        </a>
      </div>

      <p className="faint" style={{ marginTop: 10 }}>
        The entry says &ldquo;Preventah check-in&rdquo; and nothing else. It
        contains no health information and no wallet address, because a
        calendar syncs to other devices and is sometimes shared.
      </p>
    </section>
  );
}
