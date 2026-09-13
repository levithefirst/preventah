/**
 * The Preventah mark, inline.
 *
 * Inlined rather than loaded from /public so it costs no request, inherits
 * currentColor in the mono variant, and cannot flash in late over a slow
 * connection in the Mini App header. The same geometry ships as standalone
 * files in /public/brand for anywhere outside React.
 *
 * The P is a path, not type. A mark that depends on a webfont having loaded
 * is a mark that is sometimes wrong.
 */

/** Shared between the colour and mono variants so the letterform never drifts. */
const P_PATH =
  'M16 21h15.5a8.5 8.5 0 0 1 0 17h-7v9H16V21Zm8.5 5h6.5a3.5 3.5 0 0 1 0 7h-6.5v-7Z';

export function Mark({
  size = 32,
  mono = false,
  className,
}: {
  size?: number;
  /** Single-colour stamp: drops the mint, keeps the offset as an outline. */
  mono?: boolean;
  className?: string;
}) {
  // Unique per instance so two marks on one page cannot share a clip path.
  const clipId = `pv-clip-${size}${mono ? '-m' : ''}`;

  if (mono) {
    return (
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className={className}
        aria-hidden="true"
        focusable="false"
      >
        <g fill="none" stroke="currentColor">
          <rect
            x="6"
            y="6"
            width="52"
            height="52"
            rx="14"
            strokeWidth="1.5"
            opacity="0.5"
          />
          <rect x="2" y="2" width="52" height="52" rx="14" strokeWidth="2.5" />
          <path d="M2 14h52" strokeWidth="2.5" />
        </g>
        <path fill="currentColor" fillRule="evenodd" d={P_PATH} />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="2" y="2" width="52" height="52" rx="14" />
        </clipPath>
      </defs>

      {/* One step behind */}
      <rect x="6" y="6" width="52" height="52" rx="14" fill="#E8B4B8" />
      <rect x="2" y="2" width="52" height="52" rx="14" fill="#F6F1E8" />

      {/* Today bar. The grid is dropped below 28px, where it turns to mud. */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="2" y="2" width="52" height="12" fill="#B7D9C2" />
        {size >= 28 ? (
          <g stroke="#8FC4A3" strokeWidth="1" opacity="0.5">
            <path d="M10.5 2v12M19 2v12M27.5 2v12M36 2v12M44.5 2v12" />
            <path d="M2 7.5h52" />
          </g>
        ) : null}
      </g>

      <rect
        x="2"
        y="2"
        width="52"
        height="52"
        rx="14"
        fill="none"
        stroke="#141414"
        strokeWidth="2.5"
      />
      <path d="M2 14h52" stroke="#141414" strokeWidth="2.5" />
      <path fill="#141414" fillRule="evenodd" d={P_PATH} />
    </svg>
  );
}

/**
 * Mark plus wordmark.
 *
 * `as` exists because this is an h1 on the public hero and plain text
 * everywhere else, and a page with two h1s is a page with a broken outline.
 */
export function Lockup({
  size = 32,
  as: Tag = 'span',
  mono = false,
  className,
}: {
  size?: number;
  as?: 'h1' | 'span' | 'div';
  mono?: boolean;
  className?: string;
}) {
  return (
    <Tag
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        margin: 0,
      }}
    >
      <Mark size={size} mono={mono} />
      <span
        className="pv-masthead-word"
        style={{ fontSize: Math.round(size * 0.62) }}
      >
        Preventah
      </span>
    </Tag>
  );
}
