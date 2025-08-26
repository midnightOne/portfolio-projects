'use client';

import React, { useState } from 'react';
import { 
  useUIControl, 
  useNavigation, 
  useHighlighting, 
  useFocusManagement,
  useUIState,
  useKeyboardNavigation
} from '@/lib/ui/ui-control-hooks';
import type { NavigationCommand, HighlightOptions } from '@/lib/ui/types';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { EnhancedCard } from '@/components/ui/enhanced-card';

export default function TestUIControlHooksPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Test all UI control hooks
  const uiControl = useUIControl();
  const navigation = useNavigation();
  const highlighting = useHighlighting();
  const focusManagement = useFocusManagement();
  const { state: uiState, updateState } = useUIState();
  const keyboardNav = useKeyboardNavigation();

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  // Test navigation hooks
  const testScrollTo = async () => {
    setIsProcessing(true);
    try {
      const command: NavigationCommand = {
        action: 'scroll',
        target: '#test-target-1',
        options: {
          scroll: { behavior: 'smooth', block: 'center' }
        }
      };
      await uiControl.navigate(command);
      addResult('✅ ScrollTo navigation successful');
    } catch (error) {
      addResult(`❌ ScrollTo failed: ${error}`);
    }
    setIsProcessing(false);
  };

  const testNavigateTo = async () => {
    setIsProcessing(true);
    try {
      await navigation.navigateToSection('#test-target-2');
      addResult('✅ NavigateToSection successful');
    } catch (error) {
      addResult(`❌ NavigateToSection failed: ${error}`);
    }
    setIsProcessing(false);
  };

  const testOpenModal = async () => {
    setIsProcessing(true);
    try {
      await navigation.openModal('test-modal', { title: 'Test Modal' });
      addResult('✅ OpenModal successful');
      
      // Auto-close after 2 seconds
      setTimeout(async () => {
        await navigation.closeModal('test-modal');
        addResult('✅ CloseModal successful');
      }, 2000);
    } catch (error) {
      addResult(`❌ Modal operations failed: ${error}`);
    }
    setIsProcessing(false);
  };

  // Test highlighting system
  const testSpotlightHighlight = async () => {
    setIsProcessing(true);
    try {
      const options: HighlightOptions = {
        type: 'spotlight',
        intensity: 'medium',
        duration: 'timed',
        timing: 3
      };
      await highlighting.highlight('#test-target-3', options);
      addResult('✅ Spotlight highlight successful');
    } catch (error) {
      addResult(`❌ Spotlight highlight failed: ${error}`);
    }
    setIsProcessing(false);
  };

  const testOutlineHighlight = async () => {
    setIsProcessing(true);
    try {
      const options: HighlightOptions = {
        type: 'outline',
        intensity: 'strong',
        duration: 'timed',
        timing: 3
      };
      await highlighting.highlight('#test-target-4', options);
      addResult('✅ Outline highlight successful');
    } catch (error) {
      addResult(`❌ Outline highlight failed: ${error}`);
    }
    setIsProcessing(false);
  };

  const testGlowHighlight = async () => {
    setIsProcessing(true);
    try {
      const options: HighlightOptions = {
        type: 'glow',
        intensity: 'medium',
        duration: 'timed',
        timing: 3
      };
      await highlighting.highlight('#test-target-5', options);
      addResult('✅ Glow highlight successful');
    } catch (error) {
      addResult(`❌ Glow highlight failed: ${error}`);
    }
    setIsProcessing(false);
  };

  const testColorHighlight = async () => {
    setIsProcessing(true);
    try {
      const options: HighlightOptions = {
        type: 'color',
        intensity: 'subtle',
        duration: 'timed',
        timing: 3
      };
      await highlighting.highlight('#test-target-6', options);
      addResult('✅ Color highlight successful');
    } catch (error) {
      addResult(`❌ Color highlight failed: ${error}`);
    }
    setIsProcessing(false);
  };

  const testClearHighlights = async () => {
    setIsProcessing(true);
    try {
      await highlighting.clearAllHighlights();
      addResult('✅ Clear all highlights successful');
    } catch (error) {
      addResult(`❌ Clear highlights failed: ${error}`);
    }
    setIsProcessing(false);
  };

  // Test focus management
  const testSetFocus = async () => {
    setIsProcessing(true);
    try {
      await focusManagement.setFocus('#test-input');
      addResult('✅ SetFocus successful');
    } catch (error) {
      addResult(`❌ SetFocus failed: ${error}`);
    }
    setIsProcessing(false);
  };

  const testSelectText = async () => {
    setIsProcessing(true);
    try {
      await focusManagement.selectText('#test-input', { start: 0, end: 5 });
      addResult('✅ SelectText successful');
    } catch (error) {
      addResult(`❌ SelectText failed: ${error}`);
    }
    setIsProcessing(false);
  };

  const testScrollIntoView = async () => {
    setIsProcessing(true);
    try {
      await focusManagement.scrollIntoView('#test-target-7', { 
        behavior: 'smooth', 
        block: 'center' 
      });
      addResult('✅ ScrollIntoView successful');
    } catch (error) {
      addResult(`❌ ScrollIntoView failed: ${error}`);
    }
    setIsProcessing(false);
  };

  // Test state synchronization
  const testStateSync = async () => {
    setIsProcessing(true);
    try {
      const currentState = uiControl.getUIState();
      addResult(`📊 Current theme: ${currentState.theme}`);
      addResult(`📊 Current section: ${currentState.navigation.currentSection}`);
      addResult(`📊 Active highlights: ${Object.keys(currentState.highlighting.active).length}`);
      addResult(`📊 AI processing: ${currentState.ai.isProcessing}`);
      addResult(`📊 Animation FPS: ${currentState.performance.animationFPS}`);
      addResult(`📊 Skip animations: ${currentState.performance.skipAnimations}`);
      addResult(`📊 Navigation history: ${currentState.layout.aiNavigation.navigationHistory.length} items`);
      addResult('✅ State synchronization successful');
    } catch (error) {
      addResult(`❌ State sync failed: ${error}`);
    }
    setIsProcessing(false);
  };

  const testUpdateState = async () => {
    setIsProcessing(true);
    try {
      await updateState({
        navigation: {
          ...uiState.navigation,
          currentSection: '#test-section-updated'
        }
      });
      addResult('✅ State update successful');
    } catch (error) {
      addResult(`❌ State update failed: ${error}`);
    }
    setIsProcessing(false);
  };

  // Test coordinated animations
  const testCoordinatedAnimation = async () => {
    setIsProcessing(true);
    try {
      const command: NavigationCommand = {
        action: 'modal',
        target: 'coordinated-test-modal',
        options: {
          modal: { animation: 'scale', size: 'md' }
        },
        metadata: {
          source: 'user',
          timestamp: Date.now(),
          sessionId: 'test-session'
        }
      };
      await uiControl.navigate(command);
      addResult('✅ Coordinated animation successful');
      
      // Auto-close
      setTimeout(async () => {
        await navigation.closeModal('coordinated-test-modal');
        addResult('✅ Coordinated close animation successful');
      }, 2000);
    } catch (error) {
      addResult(`❌ Coordinated animation failed: ${error}`);
    }
    setIsProcessing(false);
  };

  // Test keyboard navigation
  const testKeyboardNavigation = async () => {
    setIsProcessing(true);
    try {
      addResult('🎹 Testing keyboard navigation...');
      addResult('💡 Try pressing: Esc, Tab, Ctrl+H, Ctrl+↑/↓');
      addResult('✅ Keyboard navigation listeners active');
    } catch (error) {
      addResult(`❌ Keyboard navigation failed: ${error}`);
    }
    setIsProcessing(false);
  };

  // Test accessibility features
  const testAccessibility = async () => {
    setIsProcessing(true);
    try {
      // Test screen reader announcements
      const { announceToScreenReader } = await import('@/lib/ui/ui-control-hooks');
      announceToScreenReader('Testing screen reader announcement from UI control hooks');
      addResult('✅ Screen reader announcement sent');
      
      // Test focus management with accessibility
      await focusManagement.setFocus('#test-input');
      addResult('✅ Accessible focus management successful');
      
      // Test high contrast mode
      const { enableHighContrast, disableHighContrast } = await import('@/lib/ui/ui-control-hooks');
      enableHighContrast();
      setTimeout(() => {
        disableHighContrast();
        addResult('✅ High contrast mode toggle successful');
      }, 1000);
      
    } catch (error) {
      addResult(`❌ Accessibility test failed: ${error}`);
    }
    setIsProcessing(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  // Run automated test suite
  const runAutomatedTests = async () => {
    setIsProcessing(true);
    try {
      addResult('🧪 Starting automated test suite...');
      const { runUIControlHooksTests } = await import('./test-runner');
      const results = await runUIControlHooksTests();
      
      const passed = results.filter(r => r.status === 'pass').length;
      const failed = results.filter(r => r.status === 'fail').length;
      const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
      
      addResult(`📊 Test Suite Complete: ${passed} passed, ${failed} failed`);
      addResult(`⏱️ Total Duration: ${totalDuration.toFixed(2)}ms`);
      addResult(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
      
      // Add individual results
      results.forEach(result => {
        const icon = result.status === 'pass' ? '✅' : '❌';
        addResult(`${icon} ${result.test}: ${result.message} (${result.duration.toFixed(2)}ms)`);
      });
      
    } catch (error) {
      addResult(`❌ Automated test suite failed: ${error}`);
    }
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">UI Control Hooks Test Suite</h1>
          <p className="text-muted-foreground">
            Testing navigation, highlighting, focus management, and state synchronization
          </p>
        </div>

        {/* Test Controls */}
        <EnhancedCard className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Test Controls</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Navigation Tests */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">Navigation</h3>
              <EnhancedButton 
                onClick={testScrollTo} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Test ScrollTo
              </EnhancedButton>
              <EnhancedButton 
                onClick={testNavigateTo} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Test NavigateTo
              </EnhancedButton>
              <EnhancedButton 
                onClick={testOpenModal} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Test Modal
              </EnhancedButton>
            </div>

            {/* Highlighting Tests */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">Highlighting</h3>
              <EnhancedButton 
                onClick={testSpotlightHighlight} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Spotlight
              </EnhancedButton>
              <EnhancedButton 
                onClick={testOutlineHighlight} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Outline
              </EnhancedButton>
              <EnhancedButton 
                onClick={testGlowHighlight} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Glow
              </EnhancedButton>
              <EnhancedButton 
                onClick={testColorHighlight} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Color
              </EnhancedButton>
              <EnhancedButton 
                onClick={testClearHighlights} 
                disabled={isProcessing}
                size="sm"
                variant="outline"
                className="w-full"
              >
                Clear All
              </EnhancedButton>
            </div>

            {/* Focus Management Tests */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">Focus Management</h3>
              <EnhancedButton 
                onClick={testSetFocus} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Set Focus
              </EnhancedButton>
              <EnhancedButton 
                onClick={testSelectText} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Select Text
              </EnhancedButton>
              <EnhancedButton 
                onClick={testScrollIntoView} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Scroll Into View
              </EnhancedButton>
            </div>

            {/* State Management Tests */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">State Management</h3>
              <EnhancedButton 
                onClick={testStateSync} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Get State
              </EnhancedButton>
              <EnhancedButton 
                onClick={testUpdateState} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Update State
              </EnhancedButton>
              <EnhancedButton 
                onClick={testCoordinatedAnimation} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Coordinated Anim
              </EnhancedButton>
            </div>

            {/* Advanced Tests */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">Advanced Features</h3>
              <EnhancedButton 
                onClick={testKeyboardNavigation} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Keyboard Nav
              </EnhancedButton>
              <EnhancedButton 
                onClick={testAccessibility} 
                disabled={isProcessing}
                size="sm"
                className="w-full"
              >
                Accessibility
              </EnhancedButton>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {isProcessing && "Processing..."}
              {uiControl.isAnimating && " | Animating..."}
            </div>
            <div className="flex gap-2">
              <EnhancedButton 
                onClick={runAutomatedTests} 
                disabled={isProcessing}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                🧪 Run All Tests
              </EnhancedButton>
              <EnhancedButton 
                onClick={clearResults} 
                variant="outline" 
                size="sm"
              >
                Clear Results
              </EnhancedButton>
            </div>
          </div>
        </EnhancedCard>

        {/* Test Results */}
        <EnhancedCard className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Test Results</h2>
          <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No test results yet. Click the test buttons above.
              </p>
            ) : (
              <div className="space-y-1 font-mono text-sm">
                {testResults.map((result, index) => (
                  <div key={index} className="py-1">
                    {result}
                  </div>
                ))}
              </div>
            )}
          </div>
        </EnhancedCard>

        {/* Test Targets */}
        <div className="space-y-8">
          <h2 className="text-2xl font-semibold">Test Targets</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <EnhancedCard id="test-target-1" className="p-6">
              <h3 className="font-semibold mb-2">Target 1 - ScrollTo</h3>
              <p className="text-muted-foreground">This target tests scrollTo navigation.</p>
            </EnhancedCard>

            <EnhancedCard id="test-target-2" className="p-6">
              <h3 className="font-semibold mb-2">Target 2 - NavigateTo</h3>
              <p className="text-muted-foreground">This target tests navigateToSection.</p>
            </EnhancedCard>

            <EnhancedCard id="test-target-3" className="p-6">
              <h3 className="font-semibold mb-2">Target 3 - Spotlight</h3>
              <p className="text-muted-foreground">This target tests spotlight highlighting.</p>
            </EnhancedCard>

            <EnhancedCard id="test-target-4" className="p-6">
              <h3 className="font-semibold mb-2">Target 4 - Outline</h3>
              <p className="text-muted-foreground">This target tests outline highlighting.</p>
            </EnhancedCard>

            <EnhancedCard id="test-target-5" className="p-6">
              <h3 className="font-semibold mb-2">Target 5 - Glow</h3>
              <p className="text-muted-foreground">This target tests glow highlighting.</p>
            </EnhancedCard>

            <EnhancedCard id="test-target-6" className="p-6">
              <h3 className="font-semibold mb-2">Target 6 - Color</h3>
              <p className="text-muted-foreground">This target tests color highlighting.</p>
            </EnhancedCard>

            <EnhancedCard id="test-target-7" className="p-6">
              <h3 className="font-semibold mb-2">Target 7 - Scroll Into View</h3>
              <p className="text-muted-foreground">This target tests scrollIntoView.</p>
            </EnhancedCard>

            <EnhancedCard id="test-target-8" className="p-6">
              <h3 className="font-semibold mb-2">Target 8 - Coordinated Animation</h3>
              <p className="text-muted-foreground">This target tests coordinated animations.</p>
            </EnhancedCard>
          </div>

          {/* Test Input */}
          <EnhancedCard className="p-6">
            <h3 className="font-semibold mb-4">Focus Management Test</h3>
            <input
              id="test-input"
              type="text"
              defaultValue="Test input for focus and text selection"
              className="w-full p-3 border rounded-lg bg-background"
              placeholder="This input tests focus management"
            />
          </EnhancedCard>

          {/* Additional Test Targets for Automated Tests */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <EnhancedCard id="test-target-highlight" className="p-6">
              <h3 className="font-semibold mb-2">Highlight Test Target</h3>
              <p className="text-muted-foreground">This element is used for automated highlight testing.</p>
            </EnhancedCard>

            <EnhancedCard id="test-target-scroll" className="p-6">
              <h3 className="font-semibold mb-2">Scroll Test Target</h3>
              <p className="text-muted-foreground">This element is used for automated scroll testing.</p>
            </EnhancedCard>
          </div>

          {/* Test Section */}
          <section id="test-section" className="py-8">
            <EnhancedCard className="p-6">
              <h3 className="font-semibold mb-2">Test Section</h3>
              <p className="text-muted-foreground">This section is used for navigation testing.</p>
            </EnhancedCard>
          </section>
        </div>

        {/* Current UI State Display */}
        <EnhancedCard className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Current UI State</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Theme & Layout</h4>
              <div className="space-y-1 text-muted-foreground">
                <div>Theme: {uiState.theme}</div>
                <div>Header Visible: {uiState.layout.header.visible ? 'Yes' : 'No'}</div>
                <div>Modal Open: {uiState.layout.modal.open ? 'Yes' : 'No'}</div>
                <div>AI Interface: {uiState.layout.aiInterface.position}</div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Navigation</h4>
              <div className="space-y-1 text-muted-foreground">
                <div>Current Section: {uiState.navigation.currentSection || 'None'}</div>
                <div>Can Go Back: {uiState.navigation.canGoBack ? 'Yes' : 'No'}</div>
                <div>History Length: {uiState.navigation.history.length}</div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">AI & Performance</h4>
              <div className="space-y-1 text-muted-foreground">
                <div>AI Processing: {uiState.ai.isProcessing ? 'Yes' : 'No'}</div>
                <div>Active Highlights: {Object.keys(uiState.highlighting.active).length}</div>
                <div>Animation FPS: {uiState.performance.animationFPS}</div>
                <div>Skip Animations: {uiState.performance.skipAnimations ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </div>
        </EnhancedCard>
      </div>
    </div>
  );
}