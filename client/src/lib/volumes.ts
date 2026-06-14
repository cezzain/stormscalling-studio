// Codex "volumes" (the books on the shelf). The three defaults are built in;
// users can add their own, persisted to localStorage. A custom volume defines
// a new entity-type slug that its entries are filed under.

export interface Volume {
  id: string;
  label: string;
  subtitle: string;
  cover: string; // CSS background for the book
  types: string[]; // entity types filed under this volume
  primary: string; // type created by this volume's "+ New"
  custom?: boolean;
}

export const DEFAULT_VOLUMES: Volume[] = [
  { id: 'characters', label: 'Characters', subtitle: 'The people of your world', cover: 'linear-gradient(145deg, var(--clay), var(--clay-2))', types: ['character'], primary: 'character' },
  { id: 'places', label: 'Places', subtitle: 'Nations & locations', cover: 'linear-gradient(145deg, var(--forest), var(--forest-2))', types: ['nation', 'location'], primary: 'location' },
  { id: 'lore', label: 'Factions & Lore', subtitle: 'Factions & concepts', cover: 'linear-gradient(145deg, var(--sage), var(--tan))', types: ['faction', 'concept'], primary: 'faction' },
];

// Stable cover palette for custom volumes (theme-independent so the spines keep
// their identity across colour schemes).
const COVERS = [
  'linear-gradient(145deg, #6E59C7, #4B3A9E)',
  'linear-gradient(145deg, #1C8FB3, #136F8E)',
  'linear-gradient(145deg, #B5548C, #8E3F6F)',
  'linear-gradient(145deg, #C9952E, #9E7320)',
  'linear-gradient(145deg, #4C8C6A, #356B4F)',
  'linear-gradient(145deg, #C2603F, #9E4730)',
];

const KEY = 'scs-codex-volumes';
const HIDDEN_KEY = 'scs-codex-hidden-volumes';

function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function loadHidden(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveHidden(ids: string[]) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/** Built-in volumes the user has hidden (true if any are hidden). */
export function hasHiddenDefaults(): boolean {
  return loadHidden().length > 0;
}

/** Restore all hidden built-in volumes. */
export function restoreDefaultVolumes(): Volume[] {
  saveHidden([]);
  return getVolumes();
}

const isDefault = (id: string) => DEFAULT_VOLUMES.some((v) => v.id === id);

export function loadCustomVolumes(): Volume[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Volume[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveCustomVolumes(v: Volume[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function getVolumes(): Volume[] {
  const hidden = loadHidden();
  return [...DEFAULT_VOLUMES.filter((v) => !hidden.includes(v.id)), ...loadCustomVolumes()];
}

/** Add a custom volume and return the full volume list (defaults + custom). */
export function addVolume(label: string): Volume[] {
  const custom = loadCustomVolumes();
  const taken = new Set([...DEFAULT_VOLUMES, ...custom].map((v) => v.id));
  let id = slug(label) || `volume-${Date.now()}`;
  while (taken.has(id)) id = `${id}-${Math.floor(Math.random() * 1000)}`;
  const cover = COVERS[custom.length % COVERS.length];
  const vol: Volume = { id, label: label.trim() || 'New volume', subtitle: 'Custom volume', cover, types: [id], primary: id, custom: true };
  const next = [...custom, vol];
  saveCustomVolumes(next);
  return [...DEFAULT_VOLUMES, ...next];
}

/**
 * Remove a volume and return the full volume list. Custom volumes are deleted
 * outright; built-in volumes are hidden (so they can be restored later).
 */
export function removeVolume(id: string): Volume[] {
  if (isDefault(id)) {
    const hidden = loadHidden();
    if (!hidden.includes(id)) saveHidden([...hidden, id]);
  } else {
    saveCustomVolumes(loadCustomVolumes().filter((v) => v.id !== id));
  }
  return getVolumes();
}
