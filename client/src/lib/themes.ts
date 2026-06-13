export interface ThemeDef {
  id: string;
  label: string;
  swatch: string; // accent colour shown in the picker
  dark: boolean;
}

// Order shown in the picker / settings dropdown.
export const THEMES: ThemeDef[] = [
  { id: 'light', label: 'Parchment', swatch: '#A8693C', dark: false },
  { id: 'coral', label: 'Coral', swatch: '#E76F51', dark: false },
  { id: 'ocean', label: 'Ocean', swatch: '#1CA0B3', dark: false },
  { id: 'plum', label: 'Plum', swatch: '#B5548C', dark: false },
  { id: 'dark', label: 'Midnight Forest', swatch: '#4C6C4F', dark: true },
  { id: 'midnight', label: 'Midnight Coral', swatch: '#F0855F', dark: true },
];

export const isDarkTheme = (id: string) => THEMES.find((t) => t.id === id)?.dark ?? false;
