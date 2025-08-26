/**
 * Test Page for Floating AI Interface - UI System Task 6
 * 
 * Demonstrates the floating AI interface with position transitions,
 * mode changes, narration display, and GSAP animations.
 */

'use client';

import { useState } from 'react';
import { FloatingAIInterface, type QuickAction } from '@/components/ai/floating-ai-interface';
import { useFloatingAIInterface } from '@/hooks/use-floating-ai-interface';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Sparkles, Mail, Code, Palette, Zap } from 'lucide-react';

export default function TestFloatingAIInterface() {
  // Use the floating AI interface hook
  const aiInterface = useFloatingAIInterface({
    initialPosition: 'hero',
    initialMode: 'pill',
    autoPin: true,
    expandOnFocus: true,
    persistState: true,
    storageKey: 'test-ai-interface'
  });

  // Demo content state
  const [demoStep, setDemoStep] = useState(0);

  // Quick actions for the AI interface
  const quickActions: QuickAction[] = [
    {
      id: 'show-projects',
      label: 'Show my projects',
      icon: Code,
      command: 'Show me your best projects',
      description: 'Display featured projects'
    },
    {
      id: 'about-skills',
      label: 'Tell me about skills',
      icon: Sparkles,
      command: 'What are your technical skills?',
      description: 'Discuss technical expertise'
    },
    {
      id: 'contact-info',
      label: 'How to contact',
      icon: Mail,
      command: 'How can I get in touch?',
      description: 'Show contact information'
    },
    {
      id: 'design-process',
      label: 'Design process',
      icon: Palette,
      command: 'Tell me about your design process',
      description: 'Explain design methodology'
    }
  ];

  // Demo scenarios
  const demoScenarios = [
    {
      title: 'Hero Position - Initial State',
      description: 'Interface positioned at 30vh from bottom',
      narration: null,
      position: 'hero' as const,
      mode: 'pill' as const
    },
    {
      title: 'With Narration',
      description: 'Subtitle-style narration appears above interface',
      narration: 'Welcome! I can help you explore my portfolio and answer questions about my work.',
      position: 'hero' as const,
      mode: 'pill' as const
    },
    {
      title: 'Expanded Mode',
      description: 'Interface expands to show full functionality',
      narration: 'Let me show you what I can do. Try asking about my projects or skills!',
      position: 'hero' as const,
      mode: 'expanded' as const
    },
    {
      title: 'Pinned Position',
      description: 'Interface moves to 24px from bottom after interaction',
      narration: 'Now I\'m pinned at the bottom for easy access while you browse.',
      position: 'pinned' as const,
      mode: 'pill' as const
    },
    {
      title: 'Processing State',
      description: 'Shows processing indicator while AI thinks',
      narration: 'I\'m processing your request...',
      position: 'pinned' as const,
      mode: 'expanded' as const
    }
  ];

  // Demo controls
  const nextDemo = () => {
    const nextStep = (demoStep + 1) % demoScenarios.length;
    setDemoStep(nextStep);
    const scenario = demoScenarios[nextStep];
    
    aiInterface.setPosition(scenario.position);
    aiInterface.setMode(scenario.mode);
    aiInterface.setNarration(scenario.narration);
  };

  const resetDemo = () => {
    setDemoStep(0);
    aiInterface.reset();
  };

  const currentScenario = demoScenarios[demoStep];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Floating AI Interface Test</h1>
              <p className="text-muted-foreground mt-1">
                UI System Task 6: Dynamic positioning, GSAP animations, and narration display
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              Task 6 Implementation
            </Badge>
          </div>
        </div>
      </div>

      {/* Demo Controls */}
      <div className="container mx-auto px-4 py-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Demo Controls
            </CardTitle>
            <CardDescription>
              Test different states and positions of the floating AI interface
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Scenario */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold text-sm mb-2">Current Scenario:</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{currentScenario.title}</p>
                  <p className="text-sm text-muted-foreground">{currentScenario.description}</p>
                </div>
                <Badge variant="secondary">
                  {demoStep + 1} / {demoScenarios.length}
                </Badge>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              <Button onClick={nextDemo} className="flex-1">
                Next Demo ({((demoStep + 1) % demoScenarios.length) + 1})
              </Button>
              <Button onClick={resetDemo} variant="outline">
                Reset
              </Button>
            </div>

            {/* Manual Controls */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium mb-2 block">Position</label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={aiInterface.position === 'hero' ? 'default' : 'outline'}
                    onClick={() => aiInterface.setPosition('hero')}
                  >
                    Hero (30vh)
                  </Button>
                  <Button
                    size="sm"
                    variant={aiInterface.position === 'pinned' ? 'default' : 'outline'}
                    onClick={() => aiInterface.setPosition('pinned')}
                  >
                    Pinned (24px)
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Mode</label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={aiInterface.mode === 'pill' ? 'default' : 'outline'}
                    onClick={() => aiInterface.setMode('pill')}
                  >
                    Pill
                  </Button>
                  <Button
                    size="sm"
                    variant={aiInterface.mode === 'expanded' ? 'default' : 'outline'}
                    onClick={() => aiInterface.setMode('expanded')}
                  >
                    Expanded
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Overview */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Dynamic Positioning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Smooth GSAP-powered transitions between hero (30vh) and pinned (24px) positions.
              </p>
              <ul className="text-xs space-y-1">
                <li>• 0.7s coordinated animations</li>
                <li>• Auto-pin after interaction</li>
                <li>• Responsive positioning</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Narration Display
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Subtitle-style narration appears above the interface with smooth animations.
              </p>
              <ul className="text-xs space-y-1">
                <li>• Contextual messages</li>
                <li>• Fade in/out animations</li>
                <li>• Screen reader support</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Interactive Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Voice input, text input, quick actions, and settings integration.
              </p>
              <ul className="text-xs space-y-1">
                <li>• Voice recognition</li>
                <li>• Quick action buttons</li>
                <li>• Processing states</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Sample Content for Scrolling */}
        <div className="space-y-8 pb-32">
          <Card>
            <CardHeader>
              <CardTitle>Sample Portfolio Content</CardTitle>
              <CardDescription>
                Scroll down to see how the AI interface behaves during navigation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                This is sample content to demonstrate how the floating AI interface works
                in a real portfolio context. The interface maintains its position and
                functionality while users browse through content.
              </p>
              <p>
                Try interacting with the AI interface below to see the different modes
                and animations in action. The interface supports both text and voice input,
                with smooth transitions between states.
              </p>
            </CardContent>
          </Card>

          {/* More sample content */}
          {Array.from({ length: 5 }, (_, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle>Sample Section {i + 1}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  This is additional content to provide scrolling context. The floating
                  AI interface should remain accessible and functional as you scroll
                  through this content.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Floating AI Interface */}
      <FloatingAIInterface
        position={aiInterface.position}
        onPositionChange={aiInterface.setPosition}
        mode={aiInterface.mode}
        onModeChange={aiInterface.setMode}
        currentNarration={aiInterface.currentNarration || undefined}
        placeholder="Ask me about my work, skills, or projects..."
        value={aiInterface.inputValue}
        onValueChange={aiInterface.setInputValue}
        onTextSubmit={aiInterface.handleTextSubmit}
        onVoiceStart={aiInterface.handleVoiceStart}
        onVoiceEnd={aiInterface.handleVoiceEnd}
        onSettingsClick={aiInterface.handleSettings}
        onQuickAction={aiInterface.handleQuickAction}
        onClear={aiInterface.handleClear}
        isListening={aiInterface.isListening}
        isProcessing={aiInterface.isProcessing}
        isTyping={aiInterface.isTyping}
        voiceEnabled={true}
        showQuickActions={true}
        quickActions={quickActions}
        theme="default"
        size="md"
        autoPin={true}
        expandOnFocus={true}
        animationDuration={700}
        ariaLabel="AI Portfolio Assistant"
        announceNarration={true}
      />
    </div>
  );
}