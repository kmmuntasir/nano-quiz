import { createContext } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const THEME_STORAGE_KEY = 'nanoquiz.theme';

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
