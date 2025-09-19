'use client';

import React from 'react';
import { useTheme } from '@/lib/ui/theme';

export default function TestSimpleThemePage() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Simple Theme Test</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return <TestSimpleThemeContent />;
}

function TestSimpleThemeContent() {
  const { theme, setTheme, toggleTheme, isAnimating } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Simple Theme Test</h1>
        
        <div className="space-y-4">
          <p>Current theme: <strong>{theme}</strong></p>
          <p>Is animating: <strong>{isAnimating ? 'Yes' : 'No'}</strong></p>
          
          <div className="flex gap-4">
            <button 
              onClick={toggleTheme}
              disabled={isAnimating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              Toggle Theme
            </button>
            
            <button 
              onClick={() => setTheme('light')}
              disabled={isAnimating || theme === 'light'}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 disabled:opacity-50"
            >
              Light
            </button>
            
            <button 
              onClick={() => setTheme('dark')}
              disabled={isAnimating || theme === 'dark'}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 disabled:opacity-50"
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
          <h3 className="font-semibold">CSS Custom Properties Test</h3>
          <div className="text-sm font-mono space-y-1">
            <div>--ui-ai-background: <span style={{ color: 'var(--ui-ai-background)' }}>■</span></div>
            <div>--ui-ai-border: <span style={{ color: 'var(--ui-ai-border)' }}>■</span></div>
            <div>--ui-highlight-spotlight: <span style={{ color: 'var(--ui-highlight-spotlight)' }}>■</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}