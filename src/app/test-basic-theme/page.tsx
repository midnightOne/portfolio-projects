'use client';

import React, { useState } from 'react';

export default function TestBasicThemePage() {
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');

  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(newTheme);
    
    // Apply theme class directly
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newTheme);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Basic Theme Test</h1>
        
        <div className="space-y-4">
          <p>Current theme: <strong>{currentTheme}</strong></p>
          
          <div className="flex gap-4">
            <button 
              onClick={toggleTheme}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Toggle Theme
            </button>
            
            <button 
              onClick={() => {
                setCurrentTheme('light');
                const root = document.documentElement;
                root.classList.remove('light', 'dark');
                root.classList.add('light');
              }}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
            >
              Light
            </button>
            
            <button 
              onClick={() => {
                setCurrentTheme('dark');
                const root = document.documentElement;
                root.classList.remove('light', 'dark');
                root.classList.add('dark');
              }}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
            >
              Dark
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="p-4 bg-card border rounded-lg">
            <h3 className="font-semibold mb-2">Card Background</h3>
            <p className="text-muted-foreground">This uses card background color</p>
          </div>
          
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Muted Background</h3>
            <p className="text-muted-foreground">This uses muted background color</p>
          </div>
        </div>

        <div className="mt-8 space-y-2">
          <h3 className="font-semibold">UI System CSS Properties</h3>
          <div className="text-sm font-mono space-y-1 p-4 bg-card border rounded">
            <div>--ui-ai-background: <span className="text-muted-foreground">var(--ui-ai-background)</span></div>
            <div>--ui-ai-border: <span className="text-muted-foreground">var(--ui-ai-border)</span></div>
            <div>--ui-highlight-spotlight: <span className="text-muted-foreground">var(--ui-highlight-spotlight)</span></div>
            <div>--ui-duration-normal: <span className="text-muted-foreground">var(--ui-duration-normal)</span></div>
            <div>--ui-easing-smooth: <span className="text-muted-foreground">var(--ui-easing-smooth)</span></div>
          </div>
        </div>

        <div className="mt-8 space-y-2">
          <h3 className="font-semibold">Visual Test Elements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              className="p-4 border rounded-lg ui-theme-transition"
              style={{ background: 'var(--ui-ai-background)', borderColor: 'var(--ui-ai-border)' }}
            >
              <p className="text-sm">AI Interface Background</p>
            </div>
            <div 
              className="p-4 border rounded-lg ui-theme-transition"
              style={{ background: 'var(--ui-highlight-spotlight)' }}
            >
              <p className="text-sm">Spotlight Highlight</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}