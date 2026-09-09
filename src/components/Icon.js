/**
 * The icon system.
 *
 * Drawn, not borrowed: one 16-unit grid, one 1.25 stroke, square caps and
 * mitred joins so the marks sit in the same family as the hairline rules that
 * structure every screen. Rounded caps would soften them out of the world.
 */

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
};

const PATHS = {
  /* The AEGIS mark — a shield built from the zone grid it reasons over */
  aegis: (
    <>
      <path {...S} d="M8 1.5 2.5 3.6v5.1c0 3 2.2 4.9 5.5 6.3 3.3-1.4 5.5-3.3 5.5-6.3V3.6L8 1.5Z" />
      <path {...S} d="M5.2 5.4h5.6v5.6H5.2z" />
      <path {...S} d="M8 5.4v5.6M5.2 8.2h5.6" />
    </>
  ),
  grid: (
    <>
      <path {...S} d="M2 2h12v12H2z" />
      <path {...S} d="M6 2v12M10 2v12M2 6h12M2 10h12" />
    </>
  ),
  drone: (
    <>
      <path {...S} d="M6.2 6.2h3.6v3.6H6.2z" />
      <path {...S} d="M6.2 6.2 3.4 3.4M9.8 6.2l2.8-2.8M6.2 9.8l-2.8 2.8M9.8 9.8l2.8 2.8" />
      <circle {...S} cx="3.4" cy="3.4" r="1.5" />
      <circle {...S} cx="12.6" cy="3.4" r="1.5" />
      <circle {...S} cx="3.4" cy="12.6" r="1.5" />
      <circle {...S} cx="12.6" cy="12.6" r="1.5" />
    </>
  ),
  route: (
    <>
      <path {...S} d="M4 13V6.5a2.5 2.5 0 0 1 2.5-2.5H10" />
      <path {...S} d="M8.2 2.2 10.4 4 8.2 5.8" />
      <path {...S} d="M2.6 13h2.8" />
      <circle {...S} cx="4" cy="13" r="0.1" />
    </>
  ),
  stamp: (
    <>
      <path {...S} d="M2.5 13.5h11" />
      <path {...S} d="M3.6 11.4h8.8v1.4H3.6z" />
      <path {...S} d="M6 11.4V8.6a1.6 1.6 0 0 0-.5-1.2 3 3 0 1 1 5 0 1.6 1.6 0 0 0-.5 1.2v2.8" />
    </>
  ),
  file: (
    <>
      <path {...S} d="M3.5 1.8h6L12.5 5v9.2h-9z" />
      <path {...S} d="M9.4 1.8V5h3.1" />
      <path {...S} d="M5.6 8.4h4.8M5.6 10.6h4.8" />
    </>
  ),
  forecast: (
    <>
      <path {...S} d="M2 11.5h2.6l2-6.4 2.4 8.2 1.8-4.6H14" />
      <path {...S} d="M2 2.4h12" />
      <path {...S} strokeDasharray="1.4 1.4" d="M2 6.8h12" />
    </>
  ),
  search: (
    <>
      <circle {...S} cx="7" cy="7" r="4.5" />
      <path {...S} d="m10.4 10.4 3.1 3.1" />
    </>
  ),
  alert: (
    <>
      <path {...S} d="M8 2 1.8 13.4h12.4z" />
      <path {...S} d="M8 6.2v3.4M8 11.4v.9" />
    </>
  ),
  check: <path {...S} d="m2.8 8.4 3.4 3.4 7-7.6" />,
  cross: <path {...S} d="m3.4 3.4 9.2 9.2M12.6 3.4l-9.2 9.2" />,
  play: <path {...S} d="M4.4 2.6 13 8l-8.6 5.4z" />,
  pause: <path {...S} d="M5.2 3h1.9v10H5.2zM8.9 3h1.9v10H8.9z" />,
  rewind: (
    <>
      <path {...S} d="M13 3v10L6.8 8z" />
      <path {...S} d="M3.4 3v10" />
    </>
  ),
  chevron: <path {...S} d="m5.6 3.2 5 4.8-5 4.8" />,
  sun: (
    <>
      <circle {...S} cx="8" cy="8" r="3.2" />
      <path {...S} d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3.1 3.1l1.3 1.3M11.6 11.6l1.3 1.3M12.9 3.1l-1.3 1.3M4.4 11.6l-1.3 1.3" />
    </>
  ),
  moon: <path {...S} d="M13 9.6A5.6 5.6 0 0 1 6.4 3a5.8 5.8 0 1 0 6.6 6.6Z" />,
  clock: (
    <>
      <circle {...S} cx="8" cy="8" r="6.2" />
      <path {...S} d="M8 4.3V8l2.6 1.7" />
    </>
  ),
  boat: (
    <>
      <path {...S} d="M2 10.4h12l-1.7 3.2H3.7z" />
      <path {...S} d="M8 10.4V3l4.2 3.4-4.2 1" />
    </>
  ),
  ambulance: (
    <>
      <path {...S} d="M1.8 4.6h8.4v6.2H1.8zM10.2 6.6h2.4l1.6 2.2v2h-4z" />
      <circle {...S} cx="4.6" cy="12.4" r="1.4" />
      <circle {...S} cx="11.4" cy="12.4" r="1.4" />
      <path {...S} d="M6 7.7h2.2M7.1 6.6v2.2" />
    </>
  ),
  team: (
    <>
      <circle {...S} cx="5.6" cy="5" r="2.1" />
      <circle {...S} cx="11" cy="6.2" r="1.6" />
      <path {...S} d="M1.8 13.2c0-2.4 1.7-3.9 3.8-3.9s3.8 1.5 3.8 3.9" />
      <path {...S} d="M10.4 9.5c2 0 3.4 1.3 3.4 3.4" />
    </>
  ),
  battery: (
    <>
      <path {...S} d="M1.6 5h10.2v6H1.6z" />
      <path {...S} d="M13.2 7.1h1.2v1.8h-1.2z" />
    </>
  ),
  link: (
    <>
      <path {...S} d="M6.6 9.4a2.7 2.7 0 0 0 4 .3l1.9-1.9a2.7 2.7 0 0 0-3.8-3.8l-1 1" />
      <path {...S} d="M9.4 6.6a2.7 2.7 0 0 0-4-.3L3.5 8.2a2.7 2.7 0 0 0 3.8 3.8l1-1" />
    </>
  ),
  wind: (
    <>
      <path {...S} d="M1.8 5.6h7.4a2 2 0 1 0-2-2" />
      <path {...S} d="M1.8 9.2h9a2 2 0 1 1-2 2" />
      <path {...S} d="M1.8 12.4h4.6" />
    </>
  ),
  layers: (
    <>
      <path {...S} d="M8 1.8 1.8 5 8 8.2 14.2 5z" />
      <path {...S} d="m1.8 8.4 6.2 3.2 6.2-3.2" />
      <path {...S} d="m1.8 11.6 6.2 3.2 6.2-3.2" />
    </>
  ),
  node: (
    <>
      <circle {...S} cx="8" cy="8" r="3" />
      <path {...S} d="M8 1.6v3.4M8 11v3.4M1.6 8H5M11 8h3.4" />
    </>
  ),
  bridge: (
    <>
      <path {...S} d="M1.6 9.4h12.8" />
      <path {...S} d="M1.6 9.4c2.6 0 3.4-3.6 6.4-3.6s3.8 3.6 6.4 3.6" />
      <path {...S} d="M4.4 8.4v4.6M11.6 8.4v4.6M8 5.8v7.2" />
    </>
  ),
  download: (
    <>
      <path {...S} d="M8 2v8.4" />
      <path {...S} d="m4.6 7.2 3.4 3.4 3.4-3.4" />
      <path {...S} d="M2.4 13.4h11.2" />
    </>
  ),
  copy: (
    <>
      <path {...S} d="M5.4 5.4h8.2v8.2H5.4z" />
      <path {...S} d="M10.6 5.4V2.4H2.4v8.2h3" />
    </>
  ),
  radio: (
    <>
      <circle {...S} cx="8" cy="8" r="1.8" />
      <path {...S} d="M4.9 4.9a4.4 4.4 0 0 0 0 6.2M11.1 11.1a4.4 4.4 0 0 0 0-6.2" />
      <path {...S} d="M2.7 2.7a7.5 7.5 0 0 0 0 10.6M13.3 13.3a7.5 7.5 0 0 0 0-10.6" />
    </>
  ),
  scales: (
    <>
      <path {...S} d="M8 2.4v11M4 13.6h8" />
      <path {...S} d="M2 5.2h12" />
      <path {...S} d="M4.4 5.2 2 9.8h4.8zM11.6 5.2 9.2 9.8H14z" />
    </>
  ),
};

export default function Icon({ name, size = 16, className = '', title, ...rest }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      focusable="false"
      shapeRendering="geometricPrecision"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {path}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS);
