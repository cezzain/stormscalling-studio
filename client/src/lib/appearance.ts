// User-tunable look & feel, applied live as CSS custom properties on :root and
// persisted to localStorage. Kept client-side so changes are instant.

export interface Appearance {
  clarity: number; // 0 (heavy frost) … 100 (crystal clear glass)
  glow: number;    // 0 … 100 ambient background aurora intensity
  bounce: number;  // 0 (no overshoot) … 100 (very springy)
  msWidth: number; // writing column width, px
  msLine: number;  // manuscript line spacing
  msSize: number;  // manuscript font size, px
}

export const APPEARANCE_DEFAULTS: Appearance = {
  clarity: 45,
  glow: 58,
  bounce: 55,
  msWidth: 880,
  msLine: 1.82,
  msSize: 19,
};

export const APPEARANCE_RANGES = {
  clarity: { min: 0, max: 100, step: 1 },
  glow: { min: 0, max: 100, step: 1 },
  bounce: { min: 0, max: 100, step: 1 },
  msWidth: { min: 620, max: 1040, step: 20 },
  msLine: { min: 1.4, max: 2.3, step: 0.02 },
  msSize: { min: 16, max: 24, step: 1 },
} as const;

const KEY = 'scs-appearance';

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...APPEARANCE_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...APPEARANCE_DEFAULTS };
}

export function saveAppearance(a: Appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* ignore */
  }
}

/** Push the appearance values into the live CSS custom properties. */
export function applyAppearance(a: Appearance) {
  const root = document.documentElement.style;

  // Clarity → blur: clear (100) = ~2px, frosted (0) = ~30px.
  const blur = Math.round(30 - (a.clarity / 100) * 28);
  root.setProperty('--glass-blur', `${blur}px`);

  // Glow → aurora opacity (and a softer secondary layer).
  const glow = (a.glow / 100) * 0.9;
  root.setProperty('--aurora-opacity', glow.toFixed(3));
  root.setProperty('--aurora-opacity-2', (glow * 0.7).toFixed(3));

  // Bounce → spring easing overshoot for hovers / pops.
  const overshoot = (1 + (a.bounce / 100) * 0.9).toFixed(2);
  root.setProperty('--spring', `cubic-bezier(.34, ${overshoot}, .64, 1)`);

  // Writing surface.
  root.setProperty('--ms-width', `${a.msWidth}px`);
  root.setProperty('--ms-line', String(a.msLine));
  root.setProperty('--ms-size', `${a.msSize}px`);
}
