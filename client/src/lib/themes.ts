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
  { id: 'sage', label: 'Sage Grove', swatch: '#6E8C5A', dark: false },
  { id: 'gold', label: 'Goldenrod', swatch: '#C9952E', dark: false },
  { id: 'rose', label: 'Rose Quartz', swatch: '#D06A8C', dark: false },
  { id: 'slate', label: 'Slate', swatch: '#5A7896', dark: false },
  { id: 'dark', label: 'Midnight Forest', swatch: '#4C6C4F', dark: true },
  { id: 'midnight', label: 'Midnight Coral', swatch: '#F0855F', dark: true },
  { id: 'midnight-ocean', label: 'Midnight Ocean', swatch: '#3FB0C2', dark: true },
  { id: 'midnight-plum', label: 'Midnight Plum', swatch: '#B47AD6', dark: true },
];

export const isDarkTheme = (id: string) => THEMES.find((t) => t.id === id)?.dark ?? false;
