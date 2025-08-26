'use client';

import React, { useState } from 'react';
import { useTheme, switchThemeWithAICoordination, switchToCustomTheme, getAvailableThemeVariants, customThemeVariants } from '@/lib/ui/theme';
import { EnhancedButton as Button } from '@/components/ui/enhanced-button';
import { EnhancedCard as Card } from '@/components/ui/enhanced-card';

export default function TestThemeSystemPage() {
  const { theme, setTheme, toggleTheme, isAnimating } = useTheme();
  const [selectedVariant, setSelectedVariant] = useState<keyof typeof customThemeVariants>('professional');
  const availableVariants = getAvailableThemeVariants();

  const handleAIThemeSwitch = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    await switchThemeWithAICoordination(
      newTheme,
      () => console.log('AI theme switch started'),
      () => console.log('AI theme switch completed')
    );
  };

  const handleCustomThemeSwitch = async (variant: keyof typeof customThemeVariants) => {
    setSelectedVariant(variant);
    await switchToCustomTheme(variant, theme, true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Theme System Test</h1>
          <p className="text-muted-foreground">
            Testing enhanced theme system with GSAP coordination and custom variants
          </p>
        </div>

        {/* Current Theme Status */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Current Theme Status</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Active Theme:</strong> {theme}
            </div>
            <div>
              <strong>Is Animating:</strong> {isAnimating ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Selected Variant:</strong> {selectedVariant}
            </div>
            <div>
              <strong>Available Variants:</strong> {availableVariants.length}
            </div>
          </div>
        </Card>

        {/* Basic Theme Controls */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Theme Controls</h2>
          <div className="flex gap-4 flex-wrap">
            <Button 
              onClick={toggleTheme}
              disabled={isAnimating}
              variant="default"
            >
              Toggle Theme
            </Button>
            <Button 
              onClick={() => setTheme('light')}
              disabled={isAnimating || theme === 'light'}
              variant="outline"
            >
              Light Theme
            </Button>
            <Button 
              onClick={() => setTheme('dark')}
              disabled={isAnimating || theme === 'dark'}
              variant="outline"
            >
              Dark Theme
            </Button>
          </div>
        </Card>

        {/* AI Coordination Test */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">AI Coordination Test</h2>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This tests theme switching with AI animation coordination
            </p>
            <Button 
              onClick={handleAIThemeSwitch}
              disabled={isAnimating}
              variant="secondary"
            >
              AI Coordinated Theme Switch
            </Button>
          </div>
        </Card>

        {/* Custom Theme Variants */}
        <Card className="p-6">
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
                    <Button
                      size="sm"
                      variant={selectedVariant === variant ? "default" : "outline"}
                      onClick={() => handleCustomThemeSwitch(variant as keyof typeof customThemeVariants)}
                      disabled={isAnimating}
                    >
                      Apply {variant}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Theme Preview */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Theme Preview</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Background Colors */}
              <div className="space-y-2">
                <h3 className="font-medium">Background Colors</h3>
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
                </div>
              </div>

              {/* AI Interface Colors */}
              <div className="space-y-2">
                <h3 className="font-medium">AI Interface</h3>
                <div className="space-y-1">
                  <div 
                    className="h-8 border rounded flex items-center px-2 text-xs ui-ai-interface"
                    style={{ background: 'var(--ui-ai-background)', borderColor: 'var(--ui-ai-border)' }}
                  >
                    AI Background
                  </div>
                  <div 
                    className="h-8 border rounded flex items-center px-2 text-xs"
                    style={{ background: 'var(--ui-highlight-spotlight)' }}
                  >
                    Spotlight
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
                    style={{ background: 'var(--ui-gradient-ai)' }}
                  >
                    AI Gradient
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Animation Test */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Animation Integration Test</h2>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These elements use CSS custom properties for smooth theme transitions
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="ui-theme-transition p-4 bg-accent rounded-lg">
                <p className="text-accent-foreground">Fast transition element</p>
              </div>
              <div className="ui-theme-transition-slow p-4 bg-secondary rounded-lg">
                <p className="text-secondary-foreground">Slow transition element</p>
              </div>
            </div>
          </div>
        </Card>

        {/* CSS Custom Properties Display */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">CSS Custom Properties</h2>
          <div className="text-xs font-mono space-y-1 max-h-64 overflow-y-auto">
            <div>--ui-ai-background: <span className="text-muted-foreground">var(--ui-ai-background)</span></div>
            <div>--ui-ai-border: <span className="text-muted-foreground">var(--ui-ai-border)</span></div>
            <div>--ui-highlight-spotlight: <span className="text-muted-foreground">var(--ui-highlight-spotlight)</span></div>
            <div>--ui-duration-normal: <span className="text-muted-foreground">var(--ui-duration-normal)</span></div>
            <div>--ui-easing-smooth: <span className="text-muted-foreground">var(--ui-easing-smooth)</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}