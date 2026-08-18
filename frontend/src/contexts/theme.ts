import { createContext } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const THEME_STORAGE_KEY = 'nanoquiz.theme';

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);