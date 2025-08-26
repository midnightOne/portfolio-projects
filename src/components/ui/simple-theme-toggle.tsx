'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SimpleThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SimpleThemeToggle({ className, size = 'md' }: SimpleThemeToggleProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Initialize theme on mount - prioritize system setting when no user preference exists
  useEffect(() => {
    const storedTheme = localStorage.getItem('portfolio-theme') as 'light' | 'dark' | null;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    
    // Use stored theme if exists, otherwise use system preference
    const initialTheme = storedTheme || systemTheme;
    
    setTheme(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
    
    // Listen for system theme changes when no stored preference
    if (!storedTheme) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        const newSystemTheme = e.matches ? 'dark' : 'light';
        setTheme(newSystemTheme);
        applyTheme(newSystemTheme);
      };
      
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
  }, []);

  const applyTheme = (newTheme: 'light' | 'dark') => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('portfolio-theme', newTheme);
  };

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-10 w-10'
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(sizeClasses[size], className)}
        disabled
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={cn(
        'transition-all duration-200 hover:bg-accent hover:text-accent-foreground',
        sizeClasses[size],
        className
      )}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
    >
      {theme === 'light' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}