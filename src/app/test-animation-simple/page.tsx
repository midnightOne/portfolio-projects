'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestAnimationSimplePage() {
  const [animationSystem, setAnimationSystem] = useState<any>(null);
  const [status, setStatus] = useState<string>('Loading...');

  useEffect(() => {
    // Check if animation system is available
    const checkSystem = () => {
      const system = (globalThis as any).__uiAnimationSystem;
      if (system) {
        setAnimationSystem(system);
        setStatus('Animation system loaded successfully!');
      } else {
        setStatus('Animation system not found');
      }
    };

    // Check immediately and after a delay
    checkSystem();
    const timeout = setTimeout(checkSystem, 1000);

    return () => clearTimeout(timeout);
  }, []);

  const testSpotlight = () => {
    if (animationSystem?.spotlight) {
      animationSystem.spotlight('#test-card', { intensity: 'medium', duration: 'timed', timing: 2 });
      setStatus('Spotlight animation triggered!');
    }
  };

  const testGlow = () => {
    if (animationSystem?.glow) {
      animationSystem.glow('#test-card', { intensity: 'strong', duration: 'timed', timing: 3 });
      setStatus('Glow animation triggered!');
    }
  };

  const clearHighlights = () => {
    if (animationSystem?.removeHighlight) {
      animationSystem.removeHighlight();
      setStatus('Highlights cleared!');
    }
  };

  const getPerformance = () => {
    if (animationSystem?.getPerformance) {
      const perf = animationSystem.getPerformance();
      setStatus(`FPS: ${perf.fps}, Queue: ${perf.queueMetrics.queueLength}, Animating: ${perf.queueMetrics.isAnimating}`);
    }
  };

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Simple Animation Test</h1>
        <p className="text-muted-foreground">Status: {status}</p>
      </div>

      <Card id="test-card" className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This card will be highlighted when you click the buttons below.
          </p>
          
          <div className="flex flex-wrap gap-2">
            <Button onClick={testSpotlight} disabled={!animationSystem}>
              Test Spotlight
            </Button>
            <Button onClick={testGlow} disabled={!animationSystem}>
              Test Glow
            </Button>
            <Button onClick={clearHighlights} variant="outline" disabled={!animationSystem}>
              Clear
            </Button>
            <Button onClick={getPerformance} variant="secondary" disabled={!animationSystem}>
              Performance
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Animation System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div>
              <strong>System Available:</strong> {animationSystem ? 'Yes' : 'No'}
            </div>
            {animationSystem && (
              <>
                <div>
                  <strong>Methods Available:</strong> {Object.keys(animationSystem).join(', ')}
                </div>
                <div>
                  <strong>Is Animating:</strong> {animationSystem.isAnimating?.() ? 'Yes' : 'No'}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}