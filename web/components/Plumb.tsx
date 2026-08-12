/**
 * The plumb bob wordmark glyph.
 *
 * A plumbline is the instrument that establishes true vertical, which is the
 * whole conceit: the console's job is telling you what a bid actually costs
 * once it hangs straight.
 */
export function Plumb({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={(size * 22) / 30}
      height={size}
      viewBox="0 0 22 30"
      fill="none"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <line x1="11" y1="0" x2="11" y2="15" stroke="currentColor" strokeWidth="1.4" opacity="0.45" />
      <path
        d="M11 14.5 L17 20 L11 29.5 L5 20 Z"
        fill="var(--accent)"
        stroke="var(--accent)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
