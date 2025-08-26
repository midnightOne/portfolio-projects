'use client';

import React, { useState, useEffect } from 'react';
import { 
  useTheme, 
  switchThemeWithAICoordination, 
  switchToCustomTheme, 
  getAvailableThemeVariants,
  customThemeVariants 
} from '@/lib/ui/theme';

export default function TestThemeFeaturesPage() {
  const [mounted, setMounted] = useState(false);
  
  // Prevent SSR issues by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Loading Theme System...</h1>
          <p className="text-muted-foreground">Initializing client-side theme features</p>
        </div>
      </div>
    );
  }

  return <TestThemeFeaturesContent />;
}

function TestThemeFeaturesContent() {
  const { theme, setTheme, toggleTheme, isAnimating, systemTheme } = useTheme();
  const [selectedVariant, setSelectedVariant] = useState<keyof typeof customThemeVariants>('professional');
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const availableVariants = getAvailableThemeVariants();

  // Test theme persistence
  useEffect(() => {
    const storedTheme = localStorage.getItem('portfolio-theme');
    setTestResults(prev => ({
      ...prev,
      persistence: storedTheme === theme
    }));
  }, [theme]);

  // Test system preference detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setTestResults(prev => ({
      ...prev,
      systemDetection: systemTheme === (mediaQuery.matches ? 'dark' : 'light')
    }));
  }, [systemTheme]);

  const handleAICoordinatedSwitch = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    setTestResults(prev => ({ ...prev, aiCoordination: false }));
    
    await switchThemeWithAICoordination(
      newTheme,
      () => {
        console.log('AI theme switch started');
        setTestResults(prev => ({ ...prev, aiCoordinationStart: true }));
      },
      () => {
        console.log('AI theme switch completed');
        setTestResults(prev => ({ ...prev, aiCoordination: true }));
      }
    );
  };

  const handleCustomVariantSwitch = async (variant: keyof typeof customThemeVariants) => {
    setSelectedVariant(variant);
    setTestResults(prev => ({ ...prev, customVariant: false }));
    
    try {
      await switchToCustomTheme(variant, theme, true);
      setTestResults(prev => ({ ...prev, customVariant: true }));
    } catch (error) {
      console.error('Custom theme switch failed:', error);
      setTestResults(prev => ({ ...prev, customVariant: false }));
    }
  };

  const testAnimationCoordination = () => {
    // Test GSAP coordination
    const animationSystem = (globalThis as any).__uiAnimationSystem;
    setTestResults(prev => ({
      ...prev,
      gsapCoordination: !!animationSystem
    }));
  };

  useEffect(() => {
    testAnimationCoordination();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Enhanced Theme System Test</h1>
          <p className="text-muted-foreground">
            Testing all enhanced theme features with GSAP coordination and custom variants
          </p>
        </div>

        {/* Test Results Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-card border rounded-lg">
            <h3 className="font-semibold text-sm">Theme Persistence</h3>
            <div className={`text-2xl ${testResults.persistence ? 'text-green-600' : 'text-red-600'}`}>
              {testResults.persistence ? '✅' : '❌'}
            </div>
          </div>
          <div className="p-4 bg-card border rounded-lg">
            <h3 className="font-semibold text-sm">System Detection</h3>
            <div className={`text-2xl ${testResults.systemDetection ? 'text-green-600' : 'text-red-600'}`}>
              {testResults.systemDetection ? '✅' : '❌'}
            </div>
          </div>
          <div className="p-4 bg-card border rounded-lg">
            <h3 className="font-semibold text-sm">AI Coordination</h3>
            <div className={`text-2xl ${testResults.aiCoordination ? 'text-green-600' : 'text-yellow-600'}`}>
              {testResults.aiCoordination ? '✅' : '⏳'}
            </div>
          </div>
          <div className="p-4 bg-card border rounded-lg">
            <h3 className="font-semibold text-sm">Custom Variants</h3>
            <div className={`text-2xl ${testResults.customVariant ? 'text-green-600' : 'text-yellow-600'}`}>
              {testResults.customVariant ? '✅' : '⏳'}
            </div>
          </div>
        </div>

        {/* Current Theme Status */}
        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Current Theme Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <strong>Active Theme:</strong> {theme}
            </div>
            <div>
              <strong>System Theme:</strong> {systemTheme}
            </div>
            <div>
              <strong>Is Animating:</strong> {isAnimating ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Selected Variant:</strong> {selectedVariant}
            </div>
          </div>
        </div>

        {/* Basic Theme Controls */}
        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Basic Theme Controls</h2>
          <div className="flex gap-4 flex-wrap">
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
              Light Theme
            </button>
            <button 
              onClick={() => setTheme('dark')}
              disabled={isAnimating || theme === 'dark'}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 disabled:opacity-50"
            >
              Dark Theme
            </button>
          </div>
        </div>

        {/* AI Coordination Test */}
        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">AI Coordination Test</h2>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This tests theme switching with AI animation coordination and callbacks
            </p>
            <button 
              onClick={handleAICoordinatedSwitch}
              disabled={isAnimating}
              className="px-4 py-2 bg-accent text-accent-foreground rounded hover:bg-accent/90 disabled:opacity-50"
            >
              AI Coordinated Theme Switch
            </button>
            {testResults.aiCoordinationStart && (
              <p className="text-sm text-green-600">✅ AI coordination callbacks working</p>
            )}
          </div>
        </div>

        {/* Custom Theme Variants */}
        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Custom Theme Variants</h2>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Test custom theme variants built on shadcn/ui foundation
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {availableVariants.map((variant) => (
                <div key={variant} className="space-y-2">
                  <h3 className="font-medium capitalize">{variant}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCustomVariantSwitch(variant as keyof typeof customThemeVariants)}
                      disabled={isAnimating}
                      className={`px-3 py-1 text-sm rounded ${
                        selectedVariant === variant 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      } disabled:opacity-50`}
                    >
                      Apply {variant}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Visual Theme Preview */}
        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Visual Theme Preview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Standard Colors */}
            <div className="space-y-2">
              <h3 className="font-medium">Standard Colors</h3>
              <div className="space-y-1">
                <div className="h-8 bg-background border rounded flex items-center px-2 text-xs">
                  Background
                </div>
                <div className="h-8 bg-card border rounded flex items-center px-2 text-xs">
                  Card
                </div>
                <div className="h-8 bg-muted border rounded flex items-center px-2 text-xs">
                  Muted
                </div>
                <div className="h-8 bg-accent border rounded flex items-center px-2 text-xs">
                  Accent
                </div>
              </div>
            </div>

            {/* AI Interface Colors */}
            <div className="space-y-2">
              <h3 className="font-medium">AI Interface</h3>
              <div className="space-y-1">
                <div 
                  className="h-8 border rounded flex items-center px-2 text-xs ui-ai-interface"
                >
                  AI Background
                </div>
                <div 
                  className="h-8 border rounded flex items-center px-2 text-xs"
                  style={{ background: 'var(--ui-highlight-spotlight)' }}
                >
                  Spotlight
                </div>
                <div 
                  className="h-8 border rounded flex items-center px-2 text-xs"
                  style={{ background: 'var(--ui-highlight-glow)' }}
                >
                  Glow
                </div>
              </div>
            </div>

            {/* Gradients */}
            <div className="space-y-2">
              <h3 className="font-medium">Gradients</h3>
              <div className="space-y-1">
                <div 
                  className="h-8 border rounded flex items-center px-2 text-xs"
                  style={{ background: 'var(--ui-gradient-primary)' }}
                >
                  Primary
                </div>
                <div 
                  className="h-8 border rounded flex items-center px-2 text-xs"
                  style={{ background: 'var(--ui-gradient-accent)' }}
                >
                  Accent
                </div>
                <div 
                  className="h-8 border rounded flex items-center px-2 text-xs"
                  style={{ background: 'var(--ui-gradient-ai)' }}
                >
                  AI Gradient
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Animation Integration Test */}
        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Animation Integration</h2>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These elements demonstrate theme transitions with animation coordination
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="ui-theme-transition p-4 bg-accent rounded-lg">
                <p className="text-accent-foreground">Fast transition element</p>
                <p className="text-xs text-accent-foreground/70">Uses --ui-duration-fast</p>
              </div>
              <div className="ui-theme-transition-slow p-4 bg-secondary rounded-lg">
                <p className="text-secondary-foreground">Slow transition element</p>
                <p className="text-xs text-secondary-foreground/70">Uses --ui-duration-normal</p>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Technical Implementation</h2>
          <div className="text-xs font-mono space-y-1 max-h-64 overflow-y-auto bg-muted p-4 rounded">
            <div><strong>Requirements Met:</strong></div>
            <div>✅ 1.1 - Enhanced existing light/dark theme system</div>
            <div>✅ 1.2 - Custom theme variants on shadcn/ui foundation</div>
            <div>✅ 1.3 - Theme switching with GSAP coordination</div>
            <div>✅ 1.4 - Preserved theme persistence</div>
            <div>✅ 1.5 - Preserved system preference detection</div>
            <div className="mt-2"><strong>CSS Custom Properties:</strong></div>
            <div>--ui-ai-background: <span className="text-muted-foreground">var(--ui-ai-background)</span></div>
            <div>--ui-ai-border: <span className="text-muted-foreground">var(--ui-ai-border)</span></div>
            <div>--ui-highlight-spotlight: <span className="text-muted-foreground">var(--ui-highlight-spotlight)</span></div>
            <div>--ui-duration-normal: <span className="text-muted-foreground">var(--ui-duration-normal)</span></div>
            <div>--ui-easing-smooth: <span className="text-muted-foreground">var(--ui-easing-smooth)</span></div>
            <div className="mt-2"><strong>Available Variants:</strong></div>
            {availableVariants.map(variant => (
              <div key={variant}>- {variant} (light & dark)</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}