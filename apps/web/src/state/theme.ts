import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'ei-ai.theme';

function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'dark' || value === 'light' ? value : 'light';
  } catch {
    // A browser with site data blocked still has to render.
    return 'light';
  }
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Remembering the choice is a convenience; failing to remember it is not an error.
    }
  }, [theme]);

  return { theme, toggle: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')) };
}
