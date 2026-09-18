import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { FaMoon, FaSun } from 'react-icons/fa6';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle = ({className}: ThemeToggleProps) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  const isDarkMode = theme === "dark";

  // 1. Avoid hydration mismatches by syncing state on mount
  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    const root = document.documentElement;
    
    if (nextTheme === 'dark') {
      root.classList.add('dark');
      localStorage.theme = 'dark';
      setTheme('dark');
    } else {
      root.classList.remove('dark');
      localStorage.theme = 'light';
      setTheme('light');
    }
  };

  // Render a clean placeholder skeleton until hydration is complete
  if (!mounted) {
    return <div className={clsx("w-10 h-10 rounded-xl bg-bg-sunken animate-pulse", className)} />;
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle Theme"
      title={isDarkMode ? "Lightmode" : "Darkmode"}
      className={clsx("p-2.5 rounded-xl text-brand-foreground hover:scale-105 transition-all shadow-sm cursor-pointer", className)}
    >
      {isDarkMode ? <FaSun className="size-4" /> : <FaMoon className="size-4" />}
    </button>
  );
};