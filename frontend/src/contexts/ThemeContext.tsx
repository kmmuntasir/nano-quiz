import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  THEME_STORAGE_KEY,
  ThemeContext,
  type ResolvedTheme,
  type Theme,
  type ThemeContextValue,
} from './theme';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

const NEXT_THEME: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function prefersDark(): boolean {
  const darkMedia = window.matchMedia?.(DARK_MEDIA_QUERY);
  return darkMedia?.matches === true;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [systemDark, setSystemDark] = useState<boolean>(prefersDark);

  const resolved: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  // Reflect the resolved theme on <html> (Tailwind darkMode: 'class').
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  // While in system mode, re-resolve when the OS preference changes.
  useEffect(() => {
    if (theme !== 'system') {
      return undefined;
    }
    const darkMedia = window.matchMedia?.(DARK_MEDIA_QUERY);
    if (darkMedia === undefined) {
      return undefined;
    }
    const handleChange = (): void => {
      setSystemDark(darkMedia.matches);
    };
    darkMedia.addEventListener('change', handleChange);
    return () => {
      darkMedia.removeEventListener('change', handleChange);
    };
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    const next = NEXT_THEME[theme];
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setThemeState(next);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}