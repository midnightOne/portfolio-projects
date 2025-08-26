/**
 * UI System Test Page
 * 
 * Test page to verify that the UI system foundation is working correctly.
 * Tests theme switching, design tokens, layout constants, and basic animations.
 */

'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/ui/theme';
import { useResponsive } from '@/lib/ui/use-responsive';
import { useUIControl } from '@/lib/ui/ui-control-hooks';
import { MAX_WIDTHS, CONTAINERS, UI_LAYOUT } from '@/lib/ui/layout-constants';
import { designTokens } from '@/lib/ui/design-tokens';

export default function UISystemTestPage() {
  const [mounted, setMounted] = useState(false);
  
  // Prevent SSR issues by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Loading UI System...</h1>
          <p className="text-muted-foreground">Initializing client-side UI features</p>
        </div>
      </div>
    );
  }

  return <UISystemTestContent />;
}

function UISystemTestContent() {
  const { theme, toggleTheme, isAnimating } = useTheme();
  const { breakpoint, width, height, isMobile, isDesktop } = useResponsive();
  const { highlight, removeHighlight, isAnimating: uiAnimating } = useUIControl();

  const handleHighlightTest = async () => {
    await highlight('#test-element', {
      type: 'spotlight',
      duration: 'timed',
      timing: 2000,
      intensity: 'medium',
    });
  };

  const handleRemoveHighlight = async () => {
    await removeHighlight('#test-element');
  };

  return (
    <div className={CONTAINERS.default}>
      <div style={{ maxWidth: MAX_WIDTHS.default }} className="mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">UI System Test Page</h1>
        
        {/* Theme System Test */}
        <section className="mb-8 p-6 border rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Theme System</h2>
          <div className="space-y-4">
            <p>Current theme: <strong>{theme}</strong></p>
            <p>Theme animating: <strong>{isAnimating ? 'Yes' : 'No'}</strong></p>
            <button
              onClick={toggleTheme}
              disabled={isAnimating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              Toggle Theme
            </button>
          </div>
        </section>

        {/* Responsive System Test */}
        <section className="mb-8 p-6 border rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Responsive System</h2>
          <div className="space-y-2">
            <p>Current breakpoint: <strong>{breakpoint}</strong></p>
            <p>Screen size: <strong>{width} x {height}</strong></p>
            <p>Is mobile: <strong>{isMobile ? 'Yes' : 'No'}</strong></p>
            <p>Is desktop: <strong>{isDesktop ? 'Yes' : 'No'}</strong></p>
          </div>
        </section>

        {/* Design Tokens Test */}
        <section className="mb-8 p-6 border rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Design Tokens</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Colors</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: 'var(--background)' }}
                  />
                  <span>Background</span>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: 'var(--ui-ai-background)' }}
                  />
                  <span>AI Background</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Animation Durations</h3>
              <div className="space-y-1">
                <p>Fast: <code>var(--ui-duration-fast)</code></p>
                <p>Normal: <code>var(--ui-duration-normal)</code></p>
                <p>Slow: <code>var(--ui-duration-slow)</code></p>
              </div>
            </div>
          </div>
        </section>

        {/* Layout Constants Test */}
        <section className="mb-8 p-6 border rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Layout Constants</h2>
          <div className="space-y-2">
            <p>Max width default: <code>{MAX_WIDTHS.default}</code></p>
            <p>Container default: <code>{CONTAINERS.default}</code></p>
            <p>AI Interface z-index: <code>{UI_LAYOUT.zIndex.aiInterface}</code></p>
          </div>
        </section>

        {/* Animation System Test */}
        <section className="mb-8 p-6 border rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Animation System</h2>
          <div className="space-y-4">
            <p>UI Animating: <strong>{uiAnimating ? 'Yes' : 'No'}</strong></p>
            <div 
              id="test-element"
              className="p-4 bg-secondary rounded-lg transition-all duration-300"
            >
              Test Element for Highlighting
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleHighlightTest}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Test Highlight
              </button>
              <button
                onClick={handleRemoveHighlight}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
              >
                Remove Highlight
              </button>
            </div>
          </div>
        </section>

        {/* CSS Custom Properties Test */}
        <section className="mb-8 p-6 border rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">CSS Custom Properties</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              className="p-4 rounded-lg"
              style={{ 
                background: 'var(--ui-gradient-primary)',
                color: 'var(--foreground)'
              }}
            >
              Primary Gradient
            </div>
            <div 
              className="p-4 rounded-lg ui-ai-interface"
            >
              AI Interface Style
            </div>
            <div 
              className="p-4 rounded-lg"
              style={{ 
                boxShadow: 'var(--ui-shadow-lg)',
                background: 'var(--card)',
                color: 'var(--card-foreground)'
              }}
            >
              Shadow Test
            </div>
          </div>
        </section>

        {/* Utility Classes Test */}
        <section className="mb-8 p-6 border rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Utility Classes</h2>
          <div className="space-y-4">
            <div className="ui-ai-interface ui-ai-interface-pill">
              AI Interface Pill Style
            </div>
            <div className="ui-animation-safe p-4 bg-muted rounded">
              Animation Safe Element
            </div>
            <div className="ui-desktop-first">
              Desktop First (hidden on mobile)
            </div>
            <div className="ui-mobile-fallback">
              Mobile Fallback (hidden on desktop)
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}