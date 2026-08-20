import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'qcompare-theme';
const THEME_CLASS = 'theme-slate-steel';

function getInitialMode(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'dark';
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'light' ? 'light' : 'dark';
}

function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.add(THEME_CLASS);
  root.setAttribute('data-mode', mode);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  useEffect(() => {
    applyMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* storage unavailable — theme still applies for the session */
    }
  }, [mode]);

  const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), []);
  const setThemeMode = useCallback((m: ThemeMode) => setMode(m), []);

  return { mode, toggle, setThemeMode };
}
