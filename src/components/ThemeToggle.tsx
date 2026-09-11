'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

type Theme = 'light' | 'dark';

// Applies the theme by toggling the `.dark` class (matches globals.css tokens)
// and the native color-scheme (so form controls / scrollbars match). The initial
// class is set by an inline pre-paint script in layout.tsx to avoid a flash, so
// this only has to keep React state in sync and react to clicks.
function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  // Read the theme the pre-paint script already committed after hydration.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    apply(next);
  };

  return (
    <button
      onClick={toggle}
      title={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle color theme'}
      aria-label="Toggle color theme"
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {mounted && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
