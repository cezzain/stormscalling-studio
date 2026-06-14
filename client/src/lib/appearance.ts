// User-tunable look & feel, applied live as CSS custom properties on :root and
// persisted to localStorage. Kept client-side so changes are instant.

export interface Appearance {
  clarity: number; // 0 (heavy frost) … 100 (crystal clear glass)
  tint: number;    // 0 (fully see-through) … 100 (solid frosted tint)
  sheen: number;   // 0 (flat) … 100 (bright refractive edge / Apple liquid glass)
  glow: number;    // 0 … 100 ambient background aurora intensity
  auroraSpeed: number; // 0 (still) … 100 (fast-drifting aurora)
  bounce: number;  // 0 (no overshoot) … 100 (very springy)
  msWidth: number; // writing column width, px
  msLine: number;  // manuscript line spacing
  msSize: number;  // manuscript font size, px
  autoPageWords: number; // 0 = off; otherwise auto-start a new page past N words
}

export const APPEARANCE_DEFAULTS: Appearance = {
  clarity: 55,
  tint: 58,
  sheen: 70,
  glow: 58,
  auroraSpeed: 50,
  bounce: 55,
  msWidth: 880,
  msLine: 1.82,
  msSize: 19,
  autoPageWords: 400,
};

export const APPEARANCE_RANGES = {
  clarity: { min: 0, max: 100, step: 1 },
  tint: { min: 0, max: 100, step: 1 },
  sheen: { min: 0, max: 100, step: 1 },
  glow: { min: 0, max: 100, step: 1 },
  auroraSpeed: { min: 0, max: 100, step: 1 },
  bounce: { min: 0, max: 100, step: 1 },
  msWidth: { min: 620, max: 1040, step: 20 },
  msLine: { min: 1.4, max: 2.3, step: 0.02 },
  msSize: { min: 16, max: 24, step: 1 },
  autoPageWords: { min: 0, max: 1000, step: 50 },
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

  // Tint → how much of the theme's frosted background colour shows through.
  // 0 = the glass is just blur + edge light (fully see-through), 100 = solid frost.
  root.setProperty('--glass-tint', String(a.tint));

  // Sheen → strength of the bright refractive rim & inner specular highlight
  // (this is what gives the Apple "liquid glass" look). 0…100 → 0…1.
  root.setProperty('--glass-sheen-strength', (a.sheen / 100).toFixed(3));

  // Glow → aurora opacity (and a softer secondary layer).
  const glow = (a.glow / 100) * 0.9;
  root.setProperty('--aurora-opacity', glow.toFixed(3));
  root.setProperty('--aurora-opacity-2', (glow * 0.7).toFixed(3));

  // Aurora speed → animation duration. Fast (100) ≈ 22s, slow (0) ≈ 90s.
  const dur = (90 - (a.auroraSpeed / 100) * 68).toFixed(0);
  root.setProperty('--aurora-dur', `${dur}s`);
  root.setProperty('--aurora-dur-2', `${(Number(dur) * 1.4).toFixed(0)}s`);

  // Bounce → spring easing overshoot for hovers / pops.
  const overshoot = (1 + (a.bounce / 100) * 0.9).toFixed(2);
  root.setProperty('--spring', `cubic-bezier(.34, ${overshoot}, .64, 1)`);

  // Writing surface.
  root.setProperty('--ms-width', `${a.msWidth}px`);
  root.setProperty('--ms-line', String(a.msLine));
  root.setProperty('--ms-size', `${a.msSize}px`);
}
