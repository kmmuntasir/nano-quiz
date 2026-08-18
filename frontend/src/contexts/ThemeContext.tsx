import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { THEME_STORAGE_KEY, ThemeContext, type Theme, type ThemeContextValue } from './theme';

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    const darkMedia = window.matchMedia?.('(prefers-color-scheme: dark)');
    const applyTheme = (): void => {
      const prefersDark = darkMedia?.matches === true;
      document.documentElement.classList.toggle(
        'dark',
        theme === 'dark' || (theme === 'system' && prefersDark),
      );
    };
    applyTheme();
    if (darkMedia !== undefined && theme === 'system') {
      darkMedia.addEventListener('change', applyTheme);
      return () => darkMedia.removeEventListener('change', applyTheme);
    }
    return undefined;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
