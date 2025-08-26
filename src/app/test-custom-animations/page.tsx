'use client';

import React, { useState, useRef } from 'react';
import { gsap } from 'gsap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  executeCustomAnimation,
  composeCustomAnimations,
  setAnimationVariant,
  getAvailableAnimations,
  getAvailablePlugins,
  executeIPadGridAnimation,
  resetIPadGrid,
  createComposedEffect,
  getAnimationDebugInfo,
  registerCustomAnimationPlugin,
  type AnimationPlugin,
  type CustomAnimationOptions,
} from '@/lib/ui/custom-animations';

export default function TestCustomAnimationsPage() {
  const [selectedGridIndex, setSelectedGridIndex] = useState<number | null>(null);
  const [animationVariant, setAnimationVariant] = useState('subtle');
  const [animationIntensity, setAnimationIntensity] = useState<'subtle' | 'medium' | 'strong'>('medium');
  const [debugInfo, setDebugInfo] = useState(getAnimationDebugInfo());
  
  const gridRef = useRef<HTMLDivElement>(null);
  const compositionRef = useRef<HTMLDivElement>(null);

  const refreshDebugInfo = () => {
    setDebugInfo(getAnimationDebugInfo());
  };

  const handleGridItemClick = (index: number) => {
    if (!gridRef.current) return;
    
    setSelectedGridIndex(index);
    
    const options: Partial<CustomAnimationOptions> = {
      selectedIndex: index,
      intensity: animationIntensity,
      variant: animationVariant,
    };

    executeIPadGridAnimation(gridRef.current, index, options);
    refreshDebugInfo();
  };

  const handleResetGrid = () => {
    if (!gridRef.current) return;
    
    setSelectedGridIndex(null);
    resetIPadGrid(gridRef.current);
    refreshDebugInfo();
  };

  const handleCompositionEffect = () => {
    if (!compositionRef.current) return;
    
    const effects = ['particle-burst', 'ripple-effect', 'glow-pulse'];
    createComposedEffect(compositionRef.current, effects, {
      intensity: animationIntensity,
    });
    refreshDebugInfo();
  };

  const handleSlideTransition = (direction: string) => {
    const elements = document.querySelectorAll('.slide-target');
    if (elements.length === 0) return;

    // Directly pass the direction instead of using variants
    executeCustomAnimation('slide-transition', Array.from(elements), {
      direction: direction,
      stagger: 0.1,
    });
    refreshDebugInfo();
  };

  const handleVariantChange = (animationName: string, variant: string) => {
    setAnimationVariant(animationName, variant);
    setAnimationVariant(variant);
    refreshDebugInfo();
  };

  // Register a custom demo plugin
  React.useEffect(() => {
    const demoPlugin: AnimationPlugin = {
      name: 'demo-plugin',
      version: '1.0.0',
      description: 'Demo plugin for testing custom animations',
      animations: {
        'demo-bounce': {
          name: 'Demo Bounce',
          description: 'Simple bounce animation for testing',
          duration: 0.5,
          create: (target, options) => {
            const elements = Array.isArray(target) ? target : [target];
            return gsap.timeline().to(elements, {
              y: -20,
              duration: 0.25,
              ease: 'power2.out',
              yoyo: true,
              repeat: 1,
            });
          },
          compose: true,
        },
      },
      register: () => console.log('Demo plugin registered'),
      unregister: () => console.log('Demo plugin unregistered'),
    };

    registerCustomAnimationPlugin(demoPlugin);
    refreshDebugInfo();
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Custom Animation System Test</h1>
          <p className="text-muted-foreground text-lg">
            Testing plugin architecture, iPad-style grid animations, composition effects, and runtime variant selection
          </p>
        </div>

        {/* Debug Information */}
        <Card>
          <CardHeader>
            <CardTitle>Animation System Debug Info</CardTitle>
            <CardDescription>Current state of the custom animation system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Registered Plugins</h4>
                <div className="space-y-1">
                  {debugInfo.plugins.map(plugin => (
                    <Badge key={plugin} variant="secondary">{plugin}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Available Animations</h4>
                <div className="space-y-1">
                  {debugInfo.animations.map(animation => (
                    <Badge key={animation} variant="outline">{animation}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Performance</h4>
                <div className="text-sm space-y-1">
                  <div>Registered: {debugInfo.performance.registeredCount}</div>
                  <div>Executed: {debugInfo.performance.executionCount}</div>
                  <div>Errors: {debugInfo.performance.errorCount}</div>
                </div>
              </div>
            </div>
            <Button onClick={refreshDebugInfo} variant="outline" size="sm">
              Refresh Debug Info
            </Button>
          </CardContent>
        </Card>

        {/* Animation Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Animation Controls</CardTitle>
            <CardDescription>Configure animation variants and intensity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Grid Animation Variant</label>
                <select 
                  value={animationVariant} 
                  onChange={(e) => setAnimationVariant(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="subtle">Subtle</option>
                  <option value="dramatic">Dramatic</option>
                  <option value="directional">Directional</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Animation Intensity</label>
                <select 
                  value={animationIntensity} 
                  onChange={(e) => setAnimationIntensity(e.target.value as any)}
                  className="w-full p-2 border rounded"
                >
                  <option value="subtle">Subtle</option>
                  <option value="medium">Medium</option>
                  <option value="strong">Strong</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* iPad-Style Grid Animation */}
        <Card>
          <CardHeader>
            <CardTitle>iPad-Style Grid Animation</CardTitle>
            <CardDescription>
              Click on any grid item to see the iPad-style animation where selected item grows and others animate away
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button onClick={handleResetGrid} variant="outline">
                Reset Grid
              </Button>
              <Badge variant={selectedGridIndex !== null ? "default" : "secondary"}>
                Selected: {selectedGridIndex !== null ? `Item ${selectedGridIndex + 1}` : 'None'}
              </Badge>
            </div>
            
            <div 
              ref={gridRef}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  key={index}
                  className="project-card bg-card border rounded-lg p-6 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleGridItemClick(index)}
                >
                  <div className="aspect-square bg-primary/10 rounded mb-3"></div>
                  <h3 className="font-semibold">Project {index + 1}</h3>
                  <p className="text-sm text-muted-foreground">Click to select</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Composition Effects */}
        <Card>
          <CardHeader>
            <CardTitle>Animation Composition</CardTitle>
            <CardDescription>
              Multiple animation effects combined and executed simultaneously
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div
                ref={compositionRef}
                className="w-32 h-32 bg-primary/20 rounded-lg flex items-center justify-center cursor-pointer hover:bg-primary/30 transition-colors"
                onClick={handleCompositionEffect}
              >
                <span className="text-sm font-medium">Click for Effects</span>
              </div>
            </div>
            
            <div className="text-center">
              <Button onClick={handleCompositionEffect}>
                Trigger Composition Effect
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Combines particle burst, ripple effect, and glow pulse
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Slide Transitions */}
        <Card>
          <CardHeader>
            <CardTitle>Slide Transition Variants</CardTitle>
            <CardDescription>
              Different slide animation variants with runtime selection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { key: 'left', label: 'From Left' },
                { key: 'right', label: 'From Right' },
                { key: 'up', label: 'From Bottom' },
                { key: 'down', label: 'From Top' }
              ].map(({ key, label }) => (
                <Button
                  key={key}
                  onClick={() => handleSlideTransition(key)}
                  variant="outline"
                >
                  {label}
                </Button>
              ))}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="slide-target bg-card border rounded-lg p-4"
                >
                  <h4 className="font-semibold">Slide Target {index + 1}</h4>
                  <p className="text-sm text-muted-foreground">Will animate with slide transition</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom Demo Animation */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Plugin Demo</CardTitle>
            <CardDescription>
              Testing custom plugin registration and execution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  const target = document.querySelector('.demo-target');
                  if (target) {
                    executeCustomAnimation('demo-bounce', target);
                    refreshDebugInfo();
                  }
                }}
              >
                Execute Demo Bounce
              </Button>
            </div>
            
            <div className="flex justify-center">
              <div className="demo-target w-24 h-24 bg-accent rounded-lg flex items-center justify-center">
                <span className="text-sm font-medium">Demo</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Information */}
        <Card>
          <CardHeader>
            <CardTitle>Performance & Features</CardTitle>
            <CardDescription>
              Custom animation system capabilities and performance features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Features Implemented</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Plugin architecture for custom animations
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    iPad-style grid animation with variants
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Animation composition system
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Runtime variant selection
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Fallback mechanisms
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Reduced motion support
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Built-in Plugins</h4>
                <ul className="space-y-2 text-sm">
                  <li><strong>iPad Grid:</strong> Grid selection animations</li>
                  <li><strong>Composition Effects:</strong> Particle, ripple, glow effects</li>
                  <li><strong>Transition Effects:</strong> Slide and fade transitions</li>
                  <li><strong>Demo Plugin:</strong> Custom registered plugin</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}