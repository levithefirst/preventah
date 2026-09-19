import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

/**
 * Both sweeps run hourly and filter on each member's local clock, rather
 * than scheduling per member. One cron, any number of timezones, and no
 * per-user job to clean up when someone leaves.
 */
const crons = cronJobs();

crons.hourly(
  'morning plan',
  { minuteUTC: 0 },
  internal.mail.morningSweep,
  {},
);

crons.hourly(
  'missed check-in nudge',
  { minuteUTC: 30 },
  internal.mail.nudgeSweep,
  {},
);

export default crons;
