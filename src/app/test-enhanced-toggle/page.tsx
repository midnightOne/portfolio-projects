'use client';

import React from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { SimpleThemeToggle } from '@/components/ui/simple-theme-toggle';

export default function TestEnhancedTogglePage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Enhanced Theme Toggle Test</h1>
        
        <div className="space-y-6">
          <div className="p-6 bg-card border rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Simple Theme Toggle</h2>
            <div className="flex gap-4 items-center">
              <SimpleThemeToggle size="sm" />
              <SimpleThemeToggle size="md" />
              <SimpleThemeToggle size="lg" />
            </div>
          </div>

          <div className="p-6 bg-card border rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Enhanced Theme Toggle - Button</h2>
            <div className="flex gap-4 items-center">
              <ThemeToggle variant="button" size="sm" />
              <ThemeToggle variant="button" size="md" />
              <ThemeToggle variant="button" size="lg" />
            </div>
          </div>

          <div className="p-6 bg-card border rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Enhanced Theme Toggle - With Label</h2>
            <div className="flex gap-4 items-center">
              <ThemeToggle variant="button" size="md" showLabel />
            </div>
          </div>

          <div className="p-6 bg-card border rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Enhanced Theme Toggle - Dropdown</h2>
            <div className="flex gap-4 items-center">
              <ThemeToggle variant="dropdown" size="sm" />
              <ThemeToggle variant="dropdown" size="md" />
              <ThemeToggle variant="dropdown" size="lg" />
            </div>
          </div>
        </div>

        <div className="p-6 bg-muted rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Visual Test</h2>
          <p className="text-muted-foreground mb-4">
            Use any of the theme toggles above to switch between light and dark themes.
            All toggles should work and stay in sync.
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
      </div>
    </div>
  );
}