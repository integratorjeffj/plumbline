/**
 * The console's icon set, hand-drawn as inline SVG paths.
 *
 * An icon font or an icon package would be the obvious reach here, but this
 * app ships as a static export with no runtime network requests and a
 * deliberately short dependency list. Nine 16px glyphs at a stroke weight that
 * matches Inter's is cheaper than either, and inlining them means an icon can
 * never render as a missing-glyph box on a locked-down browser.
 */

export type IconName =
  | 'packages'
  | 'findings'
  | 'matrix'
  | 'vendors'
  | 'settings'
  | 'search'
  | 'menu'
  | 'chevron'
  | 'wallet'
  | 'scale'
  | 'alert'
  | 'clock'
  | 'more';

const PATHS: Record<IconName, React.ReactNode> = {
  packages: (
    <>
      <path d="M3 4.5h10M3 8h10M3 11.5h6" />
      <path d="M2 2.5h12v11H2z" />
    </>
  ),
  findings: (
    <>
      <path d="M8 2.2 14.4 13.3H1.6z" />
      <path d="M8 6.4v3.2M8 11.6v.1" />
    </>
  ),
  matrix: (
    <>
      <path d="M2 2.5h12v11H2z" />
      <path d="M2 6.2h12M2 9.9h12M6 2.5v11M10 2.5v11" />
    </>
  ),
  vendors: (
    <>
      <circle cx="5.6" cy="5.6" r="2.4" />
      <path d="M1.6 13.4c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6" />
      <path d="M10.6 3.6a2.4 2.4 0 0 1 0 4.6M11.4 10.2c1.9.3 3 1.6 3 3.2" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.6v1.8M8 12.6v1.8M14.4 8h-1.8M3.4 8H1.6M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3M12.5 12.5l-1.3-1.3M4.8 4.8 3.5 3.5" />
    </>
  ),
  search: (
    <>
      <circle cx="7.2" cy="7.2" r="4.6" />
      <path d="m10.6 10.6 3.2 3.2" />
    </>
  ),
  menu: <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />,
  chevron: <path d="m6 3.5 5 4.5-5 4.5" />,
  wallet: (
    <>
      <path d="M1.8 4.6h12.4v8.2H1.8z" />
      <path d="M1.8 4.6 11 2.2v2.4M11.2 8.7h1.8" />
    </>
  ),
  scale: (
    <>
      <path d="M8 2.4v11.2M3.4 4.2h9.2" />
      <path d="M3.4 4.2 1.4 9h4zM12.6 4.2 10.6 9h4z" />
      <path d="M5.4 13.6h5.2" />
    </>
  ),
  alert: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8v3.6M8 10.8v.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.6V8l2.4 1.6" />
    </>
  ),
  more: (
    <>
      <circle cx="3.2" cy="8" r="1.1" />
      <circle cx="8" cy="8" r="1.1" />
      <circle cx="12.8" cy="8" r="1.1" />
    </>
  ),
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
