'use client';

import React, { useState, useEffect } from 'react';
import { SimpleThemeToggle } from '@/components/ui/simple-theme-toggle';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function TestSystemThemePage() {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
  const [storedTheme, setStoredTheme] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Get system theme
    const currentSystemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setSystemTheme(currentSystemTheme);
    
    // Get stored theme
    const stored = localStorage.getItem('portfolio-theme');
    setStoredTheme(stored);
    
    setMounted(true);
  }, []);

  const clearStoredTheme = () => {
    localStorage.removeItem('portfolio-theme');
    setStoredTheme(null);
    // Reload to test system theme detection
    window.location.reload();
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">System Theme Detection Test</h1>
        
        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Current Settings</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>System Theme:</span>
              <span className="font-mono">{systemTheme}</span>
            </div>
            <div className="flex justify-between">
              <span>Stored Theme:</span>
              <span className="font-mono">{storedTheme || 'none (will use system)'}</span>
            </div>
            <div className="flex justify-between">
              <span>Current Document Class:</span>
              <span className="font-mono">
                {document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Theme Toggles</h2>
          <div className="flex gap-4 items-center mb-4">
            <SimpleThemeToggle size="md" />
            <ThemeToggle variant="button" size="md" />
            <ThemeToggle variant="dropdown" size="md" />
          </div>
          <p className="text-sm text-muted-foreground">
            These toggles should start with your system theme preference.
          </p>
        </div>

        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Test Instructions</h2>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-muted rounded">
              <strong>Test 1 - System Theme Detection:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Clear stored theme (button below)</li>
                <li>Change your system theme (OS settings)</li>
                <li>Refresh this page</li>
                <li>Theme should match your system setting</li>
              </ol>
            </div>
            
            <div className="p-3 bg-muted rounded">
              <strong>Test 2 - Preference Persistence:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Use theme toggle to set a preference</li>
                <li>Refresh the page</li>
                <li>Theme should remain as you set it</li>
              </ol>
            </div>
          </div>
          
          <button
            onClick={clearStoredTheme}
            className="mt-4 px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
          >
            Clear Stored Theme (Test System Detection)
          </button>
        </div>

        <div className="p-6 bg-muted rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Visual Test</h2>
          <p className="text-muted-foreground mb-4">
            This content should reflect the current theme. The theme should start with your system preference
            unless you've previously set a manual preference.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-card border rounded">
              <h3 className="font-medium mb-2">Card Background</h3>
              <p className="text-sm text-muted-foreground">This uses card background</p>
            </div>
            <div className="p-4 bg-accent rounded">
              <h3 className="font-medium mb-2">Accent Background</h3>
              <p className="text-sm text-accent-foreground">This uses accent background</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Expected Behavior</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-green-600">✅</span>
              <span>First visit: Theme matches system preference</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600">✅</span>
              <span>After manual toggle: Theme persists across refreshes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600">✅</span>
              <span>After clearing storage: Returns to system preference</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600">✅</span>
              <span>System theme changes: Auto-updates when no stored preference</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}