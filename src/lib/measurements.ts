/**
 * Health measurements a user may record about themselves.
 *
 * Same principle as the condition catalog: a closed set, validated here and
 * again by the database, so nothing free-form can be stored. A measurement
 * is a number, a unit from a fixed list, and a date. There is no notes
 * field and no symptom field, deliberately.
 *
 * Everything in this module is pure and total. It is imported by the server
 * route and by the browser form, and both must agree on what is valid, so
 * neither may depend on anything environment-specific.
 */

export const MEASUREMENT_KINDS = [
  'weight',
  'waist',
  'blood_pressure',
  'resting_heart_rate',
  'blood_glucose',
  'sleep_hours',
] as const;

export type MeasurementKind = (typeof MEASUREMENT_KINDS)[number];

export interface UnitSpec {
  unit: string;
  label: string;
  /**
   * Plausible-human bounds, not clinical normal ranges. The point is to
   * reject a typo (a weight of 7000) without telling anyone their reading
   * is abnormal, which is not this app's job.
   */
  min: number;
  max: number;
  /** Decimal places kept on storage and display. */
  decimals: number;
}

export interface MeasurementSpec {
  kind: MeasurementKind;
  label: string;
  /** What the user is asked, in plain words. */
  prompt: string;
  units: readonly UnitSpec[];
  /** Blood pressure is the only paired reading. */
  secondary?: {
    label: string;
    min: number;
    max: number;
  };
  /** True when a rising number is generally the direction people want. */
  higherIsBetter: boolean;
  help: string;
}

export const MEASUREMENTS: readonly MeasurementSpec[] = [
  {
    kind: 'weight',
    label: 'Weight',
    prompt: 'Your weight',
    units: [
      { unit: 'kg', label: 'kg', min: 20, max: 400, decimals: 1 },
      { unit: 'lb', label: 'lb', min: 44, max: 880, decimals: 1 },
    ],
    higherIsBetter: false,
    help: 'Weigh at the same time of day, ideally before breakfast. Day-to-day swings of a kilo or two are water, not fat.',
  },
  {
    kind: 'waist',
    label: 'Waist',
    prompt: 'Your waist measurement',
    units: [
      { unit: 'cm', label: 'cm', min: 40, max: 250, decimals: 1 },
      { unit: 'in', label: 'in', min: 16, max: 98, decimals: 1 },
    ],
    higherIsBetter: false,
    help: 'Level with your navel, tape snug but not tight, after breathing out normally.',
  },
  {
    kind: 'blood_pressure',
    label: 'Blood pressure',
    prompt: 'Your blood pressure',
    units: [{ unit: 'mmHg', label: 'mmHg', min: 60, max: 260, decimals: 0 }],
    secondary: { label: 'Diastolic', min: 30, max: 200 },
    higherIsBetter: false,
    help: 'Sit quietly for five minutes first. Take two readings a minute apart and record the second.',
  },
  {
    kind: 'resting_heart_rate',
    label: 'Resting heart rate',
    prompt: 'Your resting heart rate',
    units: [{ unit: 'bpm', label: 'bpm', min: 25, max: 220, decimals: 0 }],
    higherIsBetter: false,
    help: 'Measured before getting up, lying still. It is one of the clearest signs that fitness is changing.',
  },
  {
    kind: 'blood_glucose',
    label: 'Blood glucose',
    prompt: 'Your blood glucose',
    units: [
      { unit: 'mmol/L', label: 'mmol/L', min: 1, max: 40, decimals: 1 },
      { unit: 'mg/dL', label: 'mg/dL', min: 18, max: 720, decimals: 0 },
    ],
    higherIsBetter: false,
    help: 'Record whether it was fasting or after a meal somewhere you keep notes; Preventah stores only the number.',
  },
  {
    kind: 'sleep_hours',
    label: 'Sleep',
    prompt: 'Hours you slept',
    units: [{ unit: 'h', label: 'hours', min: 0, max: 24, decimals: 1 }],
    higherIsBetter: true,
    help: 'Time actually asleep, as best you can tell. An estimate you record every day beats an exact figure you record twice.',
  },
];

const BY_KIND: ReadonlyMap<MeasurementKind, MeasurementSpec> = new Map(
  MEASUREMENTS.map((spec) => [spec.kind, spec]),
);

export function isMeasurementKind(value: unknown): value is MeasurementKind {
  return typeof value === 'string' && BY_KIND.has(value as MeasurementKind);
}

export function getMeasurementSpec(
  kind: MeasurementKind,
): MeasurementSpec | undefined {
  return BY_KIND.get(kind);
}

export function defaultUnitFor(kind: MeasurementKind): string {
  return BY_KIND.get(kind)?.units[0].unit ?? '';
}

/** Every (kind, unit) pair the database will accept. */
export const ALLOWED_UNITS: readonly string[] = [
  ...new Set(MEASUREMENTS.flatMap((spec) => spec.units.map((u) => u.unit))),
];

export interface ValidMeasurement {
  kind: MeasurementKind;
  unit: string;
  value: number;
  /** Diastolic, for blood pressure. Null for every other kind. */
  valueSecondary: number | null;
  measuredOn: string;
}

export type MeasurementValidation =
  | { ok: true; value: ValidMeasurement }
  | { ok: false; error: string };

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Accepts a number or a numeric string. Rejects everything else. */
function toNumber(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates one measurement from untrusted input.
 *
 * Returns an error message written for the person who typed it, not for a
 * log. Range messages name the bound so the user can see what went wrong
 * rather than guessing.
 */
export function validateMeasurement(input: {
  kind?: unknown;
  unit?: unknown;
  value?: unknown;
  valueSecondary?: unknown;
  measuredOn?: unknown;
}, today: string): MeasurementValidation {
  if (!isMeasurementKind(input.kind)) {
    return { ok: false, error: 'That is not a measurement Preventah records.' };
  }
  const spec = BY_KIND.get(input.kind)!;

  const unit =
    typeof input.unit === 'string' && input.unit.length > 0
      ? input.unit
      : spec.units[0].unit;
  const unitSpec = spec.units.find((u) => u.unit === unit);
  if (!unitSpec) {
    return {
      ok: false,
      error: `${spec.label} is recorded in ${spec.units.map((u) => u.label).join(' or ')}.`,
    };
  }

  const value = toNumber(input.value);
  if (value === null) {
    return { ok: false, error: `Enter ${spec.prompt.toLowerCase()} as a number.` };
  }
  if (value < unitSpec.min || value > unitSpec.max) {
    return {
      ok: false,
      error: `${spec.label} should be between ${unitSpec.min} and ${unitSpec.max} ${unitSpec.label}. Check the number you typed.`,
    };
  }

  let valueSecondary: number | null = null;
  if (spec.secondary) {
    const second = toNumber(input.valueSecondary);
    if (second === null) {
      return { ok: false, error: `Enter both numbers, for example 120 over 80.` };
    }
    if (second < spec.secondary.min || second > spec.secondary.max) {
      return {
        ok: false,
        error: `${spec.secondary.label} should be between ${spec.secondary.min} and ${spec.secondary.max} ${unitSpec.label}. Check the number you typed.`,
      };
    }
    if (second >= value) {
      return {
        ok: false,
        error: 'The first number (systolic) should be the higher of the two.',
      };
    }
    valueSecondary = round(second, unitSpec.decimals);
  } else if (
    input.valueSecondary !== undefined &&
    input.valueSecondary !== null &&
    input.valueSecondary !== ''
  ) {
    return {
      ok: false,
      error: `${spec.label} is a single number.`,
    };
  }

  const measuredOn =
    typeof input.measuredOn === 'string' && input.measuredOn.length > 0
      ? input.measuredOn
      : today;
  if (!ISO_DATE.test(measuredOn)) {
    return { ok: false, error: 'That date could not be read.' };
  }
  if (measuredOn > today) {
    return { ok: false, error: 'You cannot record a measurement for a future date.' };
  }

  return {
    ok: true,
    value: {
      kind: spec.kind,
      unit,
      value: round(value, unitSpec.decimals),
      valueSecondary,
      measuredOn,
    },
  };
}

export interface MeasurementPoint {
  id: string;
  kind: MeasurementKind;
  unit: string;
  value: number;
  valueSecondary: number | null;
  measuredOn: string;
}

/** "120 / 80 mmHg", "72.5 kg". Never throws on an unexpected kind. */
export function formatMeasurement(point: {
  kind: MeasurementKind;
  unit: string;
  value: number;
  valueSecondary: number | null;
}): string {
  const spec = BY_KIND.get(point.kind);
  const decimals = spec?.units.find((u) => u.unit === point.unit)?.decimals ?? 1;
  const primary = point.value.toFixed(decimals);
  if (point.valueSecondary !== null) {
    return `${primary} / ${point.valueSecondary.toFixed(decimals)} ${point.unit}`;
  }
  return `${primary} ${point.unit}`;
}

export interface Trend {
  /** Newest minus oldest, in the unit of the newest point. Null if fewer than two. */
  change: number | null;
  /** 'up' | 'down' | 'flat' | null, purely descriptive. */
  direction: 'up' | 'down' | 'flat' | null;
  first: MeasurementPoint | null;
  latest: MeasurementPoint | null;
  count: number;
}

/**
 * Describes the change across a series.
 *
 * Deliberately descriptive, never evaluative: this returns which way the
 * number moved, and the UI says so plainly. Preventah does not tell anyone
 * whether their reading is good, and does not set targets.
 *
 * Points from different units are not mixed: only the run of points sharing
 * the newest point's unit is compared, because 80 kg and 80 lb are not a
 * change of zero.
 */
export function describeTrend(points: readonly MeasurementPoint[]): Trend {
  if (points.length === 0) {
    return { change: null, direction: null, first: null, latest: null, count: 0 };
  }
  // Callers pass oldest-first. Be robust to either order.
  const sorted = [...points].sort((a, b) =>
    a.measuredOn < b.measuredOn ? -1 : a.measuredOn > b.measuredOn ? 1 : 0,
  );
  const latest = sorted[sorted.length - 1];
  const sameUnit = sorted.filter((p) => p.unit === latest.unit);
  const first = sameUnit[0];

  if (sameUnit.length < 2) {
    return {
      change: null,
      direction: null,
      first: latest,
      latest,
      count: sorted.length,
    };
  }

  const change = latest.value - first.value;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  return { change, direction, first, latest, count: sorted.length };
}
