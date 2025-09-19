'use client';

import React from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function TestThemeTogglePage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Theme Toggle Test</h1>
        
        <div className="space-y-6">
          <div className="p-6 bg-card border rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Button Variant</h2>
            <div className="flex gap-4 items-center">
              <ThemeToggle variant="button" size="sm" />
              <ThemeToggle variant="button" size="md" />
              <ThemeToggle variant="button" size="lg" />
            </div>
          </div>

          <div className="p-6 bg-card border rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Button with Label</h2>
            <div className="flex gap-4 items-center">
              <ThemeToggle variant="button" size="md" showLabel />
            </div>
          </div>

          <div className="p-6 bg-card border rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Dropdown Variant</h2>
            <div className="flex gap-4 items-center">
              <ThemeToggle variant="dropdown" size="sm" />
              <ThemeToggle variant="dropdown" size="md" />
              <ThemeToggle variant="dropdown" size="lg" />
            </div>
          </div>
        </div>

        <div className="p-6 bg-muted rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Visual Test</h2>
          <p className="text-muted-foreground">
            Use the theme toggles above to switch between light and dark themes.
            This content should update smoothly with the theme changes.
          </p>
        </div>
      </div>
    </div>
  );
}