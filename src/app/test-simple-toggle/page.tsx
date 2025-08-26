'use client';

import React from 'react';
import { SimpleThemeToggle } from '@/components/ui/simple-theme-toggle';

export default function TestSimpleTogglePage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Simple Theme Toggle Test</h1>
        
        <div className="space-y-6">
          <div className="p-6 bg-card border rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Theme Toggle Sizes</h2>
            <div className="flex gap-4 items-center">
              <SimpleThemeToggle size="sm" />
              <SimpleThemeToggle size="md" />
              <SimpleThemeToggle size="lg" />
            </div>
          </div>

          <div className="p-6 bg-muted rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Visual Test</h2>
            <p className="text-muted-foreground mb-4">
              Use the theme toggles above to switch between light and dark themes.
              This content should update immediately with the theme changes.
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
    </div>
  );
}