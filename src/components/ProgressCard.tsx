'use client';

import { useMemo, useState } from 'react';
import {
  MEASUREMENTS,
  defaultUnitFor,
  formatMeasurement,
  getMeasurementSpec,
  validateMeasurement,
  type MeasurementKind,
  type MeasurementPoint,
} from '@/lib/measurements';
import type { MeasurementSeries } from '@/lib/state';

/**
 * Progress tracking.
 *
 * Everything here is user-entered. Preventah connects to no wearable, no
 * health platform and no device, and does not want to: that would be a
 * much larger pile of somebody's health data to be responsible for.
 *
 * The charts are inline SVG with no charting library. A sparkline is a
 * polyline through normalised points, which is a few lines of arithmetic,
 * and shipping a charting library into a WebView for that would be the
 * expensive way to do it.
 */

const CHART_WIDTH = 280;
const CHART_HEIGHT = 56;
const CHART_PAD = 4;

interface Series {
  values: number[];
  color: string;
}

function pathFor(values: number[], min: number, span: number): string {
  if (values.length === 0) return '';
  const usableW = CHART_WIDTH - CHART_PAD * 2;
  const usableH = CHART_HEIGHT - CHART_PAD * 2;
  const step = values.length > 1 ? usableW / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = CHART_PAD + (values.length > 1 ? index * step : usableW / 2);
      // SVG y grows downward, so a larger value must sit higher up.
      const y = CHART_PAD + usableH - ((value - min) / span) * usableH;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * A sparkline over one or two series.
 *
 * Intentionally has no axes and no gridlines. It shows the shape of the
 * change; the exact numbers are listed underneath, where they can be read
 * rather than estimated off a pixel.
 */
function Sparkline({ series, label }: { series: Series[]; label: string }) {
  const all = series.flatMap((s) => s.values);
  if (all.length === 0) return null;

  const min = Math.min(...all);
  const max = Math.max(...all);
  // A flat line would divide by zero. Give it a band so it renders centred.
  const span = max - min === 0 ? Math.max(Math.abs(max) * 0.1, 1) : max - min;
  const base = max - min === 0 ? min - span / 2 : min;

  return (
    <svg
      className="spark"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {series.map((s, index) => {
        const d = pathFor(s.values, base, span);
        const last = s.values[s.values.length - 1];
        const usableH = CHART_HEIGHT - CHART_PAD * 2;
        const cy = CHART_PAD + usableH - ((last - base) / span) * usableH;
        return (
          <g key={index}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2" />
            {s.values.length === 1 ? null : (
              <circle
                cx={CHART_WIDTH - CHART_PAD}
                cy={cy}
                r="3"
                fill={s.color}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function TrendLine({ series }: { series: MeasurementSeries }) {
  const spec = getMeasurementSpec(series.kind);
  const { trend } = series;

  if (!spec || trend.latest === null) return null;

  if (trend.change === null) {
    return (
      <p className="faint">
        One reading so far. Record another to see a trend.
      </p>
    );
  }

  const magnitude = Math.abs(trend.change);
  const decimals =
    spec.units.find((u) => u.unit === trend.latest!.unit)?.decimals ?? 1;
  const word =
    trend.direction === 'up'
      ? 'up'
      : trend.direction === 'down'
        ? 'down'
        : 'unchanged';

  return (
    <p className="faint">
      {trend.direction === 'flat'
        ? `Unchanged across ${trend.count} readings.`
        : `${word} ${magnitude.toFixed(decimals)} ${trend.latest.unit} across ${trend.count} readings, since ${trend.first?.measuredOn}.`}
    </p>
  );
}

function SeriesBlock({
  series,
  busy,
  onDelete,
}: {
  series: MeasurementSeries;
  busy: boolean;
  onDelete: (point: MeasurementPoint) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const spec = getMeasurementSpec(series.kind);
  if (!spec || series.points.length === 0) return null;

  const primary: Series = {
    values: series.points.map((p) => p.value),
    color: 'var(--accent)',
  };
  const secondary =
    series.points[0].valueSecondary !== null
      ? {
          values: series.points.map((p) => p.valueSecondary ?? 0),
          color: 'var(--text-faint)',
        }
      : null;

  // Newest first for reading, which is the opposite of chart order.
  const listed = [...series.points].reverse();
  const visible = showAll ? listed : listed.slice(0, 3);

  return (
    <div className="series">
      <div className="row-between">
        <h3>{spec.label}</h3>
        <span className="series-latest">
          {formatMeasurement(series.points[series.points.length - 1])}
        </span>
      </div>

      <Sparkline
        series={secondary ? [primary, secondary] : [primary]}
        label={`${spec.label} over ${series.points.length} readings`}
      />

      <TrendLine series={series} />

      <ul className="series-list">
        {visible.map((point) => (
          <li key={point.id}>
            <span className="mono">{point.measuredOn}</span>
            <span>{formatMeasurement(point)}</span>
            <button
              type="button"
              className="btn-linklike"
              disabled={busy}
              onClick={() => onDelete(point)}
              aria-label={`Delete ${spec.label} from ${point.measuredOn}`}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {listed.length > 3 ? (
        <button
          type="button"
          className="btn-linklike"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? 'Show fewer' : `Show all ${listed.length}`}
        </button>
      ) : null}
    </div>
  );
}

export default function ProgressCard({
  measurements,
  today,
  busy,
  onRecord,
  onDelete,
}: {
  measurements: readonly MeasurementSeries[];
  today: string;
  busy: boolean;
  onRecord: (input: {
    kind: MeasurementKind;
    unit: string;
    value: string;
    valueSecondary: string;
    measuredOn: string;
  }) => void;
  onDelete: (id: string) => void;
}) {
  const [kind, setKind] = useState<MeasurementKind>('weight');
  const [unit, setUnit] = useState<string>(() => defaultUnitFor('weight'));
  const [value, setValue] = useState('');
  const [valueSecondary, setValueSecondary] = useState('');
  const [measuredOn, setMeasuredOn] = useState(today);
  const [error, setError] = useState<string | null>(null);

  const spec = getMeasurementSpec(kind);
  const unitSpec = spec?.units.find((u) => u.unit === unit) ?? spec?.units[0];

  const ordered = useMemo(() => {
    // Render in MEASUREMENTS order rather than whatever order the rows
    // arrived in, so the page does not reshuffle as readings are added.
    const byKind = new Map(measurements.map((s) => [s.kind, s]));
    return MEASUREMENTS.map((m) => byKind.get(m.kind)).filter(
      (s): s is MeasurementSeries => s !== undefined,
    );
  }, [measurements]);

  function changeKind(next: MeasurementKind) {
    setKind(next);
    setUnit(defaultUnitFor(next));
    setValue('');
    setValueSecondary('');
    setError(null);
  }

  function submit() {
    // Validate with the same function the server uses, so the user gets
    // the message immediately instead of after a round trip.
    const result = validateMeasurement(
      { kind, unit, value, valueSecondary, measuredOn },
      today,
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onRecord({ kind, unit, value, valueSecondary, measuredOn });
    setValue('');
    setValueSecondary('');
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Your progress</h2>
      </div>

      <p className="muted" style={{ marginBottom: 12 }}>
        Optional. Record a number whenever you like and watch it move.
        Preventah never tells you whether a reading is good or bad, and sets
        no targets. Everything here is typed by you; nothing is read from a
        device or another app.
      </p>

      <div className="chips" role="group" aria-label="Measurement type">
        {MEASUREMENTS.map((m) => (
          <button
            key={m.kind}
            type="button"
            className={`chip${kind === m.kind ? ' chip-on' : ''}`}
            onClick={() => changeKind(m.kind)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {spec ? (
        <div className="measure-form">
          <label className="field-label" htmlFor="measure-value">
            {spec.prompt}
          </label>

          <div className="measure-row">
            <input
              id="measure-value"
              className="measure-input"
              type="text"
              inputMode="decimal"
              placeholder={spec.secondary ? 'Systolic' : unitSpec?.label}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />

            {spec.secondary ? (
              <>
                <span className="measure-sep" aria-hidden="true">
                  /
                </span>
                <input
                  className="measure-input"
                  type="text"
                  inputMode="decimal"
                  placeholder={spec.secondary.label}
                  aria-label={spec.secondary.label}
                  value={valueSecondary}
                  onChange={(event) => setValueSecondary(event.target.value)}
                />
              </>
            ) : null}

            {spec.units.length > 1 ? (
              <select
                className="measure-unit"
                value={unit}
                aria-label="Unit"
                onChange={(event) => setUnit(event.target.value)}
              >
                {spec.units.map((u) => (
                  <option key={u.unit} value={u.unit}>
                    {u.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="measure-unit-static">{unitSpec?.label}</span>
            )}
          </div>

          <label className="field-label" htmlFor="measure-date">
            Date
          </label>
          <input
            id="measure-date"
            className="measure-input"
            type="date"
            max={today}
            value={measuredOn}
            onChange={(event) => setMeasuredOn(event.target.value)}
          />

          <p className="faint" style={{ marginTop: 8 }}>
            {spec.help}
          </p>

          {error ? <div className="notice error">{error}</div> : null}

          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || value.trim().length === 0}
            onClick={submit}
          >
            {busy ? <span className="spinner dark" /> : null}
            {busy ? 'Saving' : 'Record'}
          </button>
        </div>
      ) : null}

      {ordered.length === 0 ? (
        <p className="faint" style={{ marginTop: 16 }}>
          Nothing recorded yet. One number today gives you something to
          compare against next week.
        </p>
      ) : (
        <div className="series-stack">
          {ordered.map((series) => (
            <SeriesBlock
              key={series.kind}
              series={series}
              busy={busy}
              onDelete={(point) => onDelete(point.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
