'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  executeSpotlightHighlight,
  executeOutlineHighlight,
  executeGlowHighlight,
  executeColorHighlight,
  removeHighlight,
  executeProjectModalAnimation,
  executeProjectModalCloseAnimation,
  executeCoordinatedAnimations,
  createCoordinatedSequence,
  getAnimationQueueDebugInfo,
  forceAnimationCleanup,
} from '@/lib/ui/animation';
import type { AnimationCommand } from '@/lib/ui/animation';

export default function TestAnimationSystemPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setDebugInfo(getAnimationQueueDebugInfo());
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const testSpotlightHighlight = () => {
    executeSpotlightHighlight('#test-card-1', 'medium', 'timed', 3);
  };

  const testOutlineHighlight = () => {
    executeOutlineHighlight('#test-card-2', 'strong', 'persistent');
  };

  const testGlowHighlight = () => {
    executeGlowHighlight('#test-card-3', 'medium', 'timed', 2);
  };

  const testColorHighlight = () => {
    executeColorHighlight('#test-card-4', 'subtle', 'persistent');
  };

  const testCoordinatedModal = async () => {
    setModalOpen(true);
    await executeProjectModalAnimation('#test-project-card', '#test-modal');
  };

  const testModalClose = async () => {
    await executeProjectModalCloseAnimation('#test-project-card', '#test-modal');
    setModalOpen(false);
  };

  const testCoordinatedSequence = () => {
    const commands = createCoordinatedSequence(
      '#test-project-card',
      '#test-modal',
      'body'
    );
    executeCoordinatedAnimations(commands);
    setModalOpen(true);
  };

  const clearHighlights = () => {
    removeHighlight();
  };

  const forceCleanup = () => {
    forceAnimationCleanup();
    setModalOpen(false);
  };

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Animation System Test</h1>
        <p className="text-muted-foreground">
          Test the enhanced GSAP animation orchestration system with coordinated 0.7s transitions
        </p>
      </div>

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle>Animation Queue Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Queue Length:</strong> {debugInfo?.queueMetrics.queueLength || 0}
            </div>
            <div>
              <strong>Is Animating:</strong> {debugInfo?.queueMetrics.isAnimating ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Current Animation:</strong> {debugInfo?.queueMetrics.currentAnimationId || 'None'}
            </div>
            <div>
              <strong>Coordinated Count:</strong> {debugInfo?.queueMetrics.coordinatedCount || 0}
            </div>
            <div>
              <strong>FPS:</strong> {debugInfo?.performance.fps || 'N/A'}
            </div>
            <div>
              <strong>Frame Time:</strong> {debugInfo?.performance.frameTime?.toFixed(2) || 'N/A'}ms
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Highlighting Tests */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Highlighting System Tests</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card id="test-card-1" className="ui-highlight-base">
            <CardHeader>
              <CardTitle className="text-sm">Spotlight Test</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={testSpotlightHighlight} size="sm">
                Test Spotlight
              </Button>
            </CardContent>
          </Card>

          <Card id="test-card-2" className="ui-highlight-base">
            <CardHeader>
              <CardTitle className="text-sm">Outline Test</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={testOutlineHighlight} size="sm">
                Test Outline
              </Button>
            </CardContent>
          </Card>

          <Card id="test-card-3" className="ui-highlight-base">
            <CardHeader>
              <CardTitle className="text-sm">Glow Test</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={testGlowHighlight} size="sm">
                Test Glow
              </Button>
            </CardContent>
          </Card>

          <Card id="test-card-4" className="ui-highlight-base">
            <CardHeader>
              <CardTitle className="text-sm">Color Test</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={testColorHighlight} size="sm">
                Test Color
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2">
          <Button onClick={clearHighlights} variant="outline">
            Clear All Highlights
          </Button>
          <Button onClick={forceCleanup} variant="destructive">
            Force Cleanup
          </Button>
        </div>
      </div>

      {/* Modal Animation Tests */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Modal Animation Tests</h2>
        
        <Card 
          id="test-project-card" 
          className="ui-project-card max-w-md mx-auto cursor-pointer"
          onClick={testCoordinatedModal}
        >
          <CardHeader>
            <CardTitle>Test Project Card</CardTitle>
            <Badge>Click to open modal</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This card will grow and trigger a coordinated modal animation
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-center">
          <Button onClick={testCoordinatedModal}>
            Open Modal (Standard)
          </Button>
          <Button onClick={testCoordinatedSequence} variant="outline">
            Open Modal (Coordinated)
          </Button>
          {modalOpen && (
            <Button onClick={testModalClose} variant="destructive">
              Close Modal
            </Button>
          )}
        </div>
      </div>

      {/* Test Modal */}
      {modalOpen && (
        <div 
          id="test-modal" 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ pointerEvents: 'auto' }}
        >
          <Card className="w-full max-w-lg" data-modal-content>
            <CardHeader>
              <CardTitle>Test Modal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" data-modal-content>
              <p>This is a test modal with coordinated animations.</p>
              <p>The animation includes:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Project card growth (0.7s)</li>
                <li>Background blur effect (0.7s)</li>
                <li>Modal content load with stagger</li>
              </ul>
              <Button onClick={testModalClose} className="w-full">
                Close Modal
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Info */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Skip Animations:</strong> {debugInfo?.performance.skipAnimations ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Memory Usage:</strong> {
                debugInfo?.performance.memoryUsage 
                  ? `${(debugInfo.performance.memoryUsage / 1024 / 1024).toFixed(2)} MB`
                  : 'N/A'
              }
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}