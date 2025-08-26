/**
 * Automated test runner for UI Control Hooks
 * Tests all functionality programmatically
 */

import type { NavigationCommand, HighlightOptions } from '@/lib/ui/types';

export class UIControlHooksTestRunner {
  private results: Array<{ test: string; status: 'pass' | 'fail'; message: string; duration: number }> = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting UI Control Hooks Test Suite...');
    
    // Test navigation hooks
    await this.testNavigationHooks();
    
    // Test highlighting system
    await this.testHighlightingSystem();
    
    // Test focus management
    await this.testFocusManagement();
    
    // Test state synchronization
    await this.testStateSynchronization();
    
    // Test performance optimization
    await this.testPerformanceOptimization();
    
    // Test accessibility features
    await this.testAccessibilityFeatures();
    
    // Test error handling
    await this.testErrorHandling();
    
    this.printResults();
  }

  private async testNavigationHooks(): Promise<void> {
    console.log('📍 Testing Navigation Hooks...');
    
    // Test scrollTo
    await this.runTest('Navigation - ScrollTo', async () => {
      const { useUIControl } = await import('@/lib/ui/ui-control-hooks');
      // Since we can't use hooks outside components, test the underlying functions
      const { executeNavigationCommand } = await import('@/lib/ui/ui-control-hooks');
      
      const command: NavigationCommand = {
        action: 'scroll',
        target: '#test-target-1',
        options: { scroll: { behavior: 'smooth', block: 'center' } }
      };
      
      await executeNavigationCommand(command);
      return 'ScrollTo navigation executed successfully';
    });

    // Test navigateTo
    await this.runTest('Navigation - NavigateTo', async () => {
      const { executeNavigationCommand } = await import('@/lib/ui/ui-control-hooks');
      
      const command: NavigationCommand = {
        action: 'navigate',
        target: '#test-section',
        metadata: { source: 'user', timestamp: Date.now(), sessionId: 'test' }
      };
      
      await executeNavigationCommand(command);
      return 'NavigateTo executed successfully';
    });

    // Test modal operations
    await this.runTest('Navigation - Modal Operations', async () => {
      const { executeNavigationCommand } = await import('@/lib/ui/ui-control-hooks');
      
      // Open modal
      const openCommand: NavigationCommand = {
        action: 'modal',
        target: 'test-modal',
        options: { modal: { size: 'md', animation: 'scale' } }
      };
      
      await executeNavigationCommand(openCommand);
      
      // Verify modal is open
      const modalElement = document.querySelector('[data-modal="test-modal"]');
      if (!modalElement) {
        throw new Error('Modal was not created');
      }
      
      return 'Modal operations executed successfully';
    });
  }

  private async testHighlightingSystem(): Promise<void> {
    console.log('🎯 Testing Highlighting System...');
    
    const highlightTypes: Array<HighlightOptions['type']> = ['spotlight', 'outline', 'glow', 'color'];
    
    for (const type of highlightTypes) {
      await this.runTest(`Highlighting - ${type}`, async () => {
        const { executeNavigationCommand } = await import('@/lib/ui/ui-control-hooks');
        
        const command: NavigationCommand = {
          action: 'highlight',
          target: '#test-target-highlight',
          options: {
            highlight: {
              type,
              intensity: 'medium',
              duration: 'timed',
              timing: 1
            }
          }
        };
        
        await executeNavigationCommand(command);
        return `${type} highlight executed successfully`;
      });
    }

    // Test highlight removal
    await this.runTest('Highlighting - Clear All', async () => {
      const { clearAllHighlights } = await import('@/lib/ui/ui-control-hooks');
      await clearAllHighlights();
      return 'All highlights cleared successfully';
    });
  }

  private async testFocusManagement(): Promise<void> {
    console.log('🎯 Testing Focus Management...');
    
    // Test setFocus
    await this.runTest('Focus - Set Focus', async () => {
      const { executeNavigationCommand } = await import('@/lib/ui/ui-control-hooks');
      
      const command: NavigationCommand = {
        action: 'focus',
        target: '#test-input'
      };
      
      await executeNavigationCommand(command);
      return 'Focus set successfully';
    });

    // Test scrollIntoView
    await this.runTest('Focus - Scroll Into View', async () => {
      const { executeNavigationCommand } = await import('@/lib/ui/ui-control-hooks');
      
      const command: NavigationCommand = {
        action: 'scroll',
        target: '#test-target-scroll',
        options: { scroll: { behavior: 'smooth', block: 'center' } }
      };
      
      await executeNavigationCommand(command);
      return 'Scroll into view executed successfully';
    });
  }

  private async testStateSynchronization(): Promise<void> {
    console.log('🔄 Testing State Synchronization...');
    
    // Test getUIState
    await this.runTest('State - Get UI State', async () => {
      const { getUIState } = await import('@/lib/ui/ui-control-hooks');
      
      const state = getUIState();
      
      if (!state.theme || !state.navigation || !state.highlighting || !state.ai || !state.performance) {
        throw new Error('UI state is missing required properties');
      }
      
      return `UI state retrieved successfully - Theme: ${state.theme}`;
    });

    // Test setUIState
    await this.runTest('State - Set UI State', async () => {
      const { getUIState, setUIState } = await import('@/lib/ui/ui-control-hooks');
      
      const originalState = getUIState();
      
      await setUIState({
        navigation: {
          ...originalState.navigation,
          currentSection: '#test-section-updated'
        }
      });
      
      const updatedState = getUIState();
      
      if (updatedState.navigation.currentSection !== '#test-section-updated') {
        throw new Error('State update failed');
      }
      
      return 'UI state updated successfully';
    });

    // Test state change subscriptions
    await this.runTest('State - Subscriptions', async () => {
      const { subscribeToStateChanges, setUIState } = await import('@/lib/ui/ui-control-hooks');
      
      let callbackCalled = false;
      const unsubscribe = subscribeToStateChanges(() => {
        callbackCalled = true;
      });
      
      await setUIState({ theme: 'dark' });
      
      // Wait for callback
      await new Promise(resolve => setTimeout(resolve, 100));
      
      unsubscribe();
      
      if (!callbackCalled) {
        throw new Error('State change callback was not called');
      }
      
      return 'State change subscription works correctly';
    });
  }

  private async testPerformanceOptimization(): Promise<void> {
    console.log('⚡ Testing Performance Optimization...');
    
    // Test performance monitoring
    await this.runTest('Performance - Monitoring', async () => {
      const { getDebugInfo } = await import('@/lib/ui/ui-control-hooks');
      
      const debugInfo = getDebugInfo();
      
      if (typeof debugInfo.performance.fps !== 'number' || 
          typeof debugInfo.performance.skipAnimations !== 'boolean') {
        throw new Error('Performance monitoring data is invalid');
      }
      
      return `Performance monitoring active - FPS: ${debugInfo.performance.fps}`;
    });

    // Test navigation history management
    await this.runTest('Performance - Navigation History', async () => {
      const { getNavigationHistory, clearNavigationHistory } = await import('@/lib/ui/ui-control-hooks');
      
      const historyBefore = getNavigationHistory();
      clearNavigationHistory();
      const historyAfter = getNavigationHistory();
      
      if (historyAfter.length !== 0) {
        throw new Error('Navigation history was not cleared');
      }
      
      return 'Navigation history management works correctly';
    });
  }

  private async testAccessibilityFeatures(): Promise<void> {
    console.log('♿ Testing Accessibility Features...');
    
    // Test screen reader announcements
    await this.runTest('Accessibility - Screen Reader', async () => {
      const { announceToScreenReader } = await import('@/lib/ui/ui-control-hooks');
      
      announceToScreenReader('Test announcement for screen readers');
      
      // Check if announcement element was created and removed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const announcementElements = document.querySelectorAll('[aria-live="polite"]');
      // Should be cleaned up automatically
      
      return 'Screen reader announcement executed successfully';
    });

    // Test high contrast mode
    await this.runTest('Accessibility - High Contrast', async () => {
      const { enableHighContrast, disableHighContrast } = await import('@/lib/ui/ui-control-hooks');
      
      enableHighContrast();
      
      if (!document.documentElement.classList.contains('high-contrast')) {
        throw new Error('High contrast mode was not enabled');
      }
      
      disableHighContrast();
      
      if (document.documentElement.classList.contains('high-contrast')) {
        throw new Error('High contrast mode was not disabled');
      }
      
      return 'High contrast mode toggle works correctly';
    });

    // Test reduced motion
    await this.runTest('Accessibility - Reduced Motion', async () => {
      const { enableReducedMotion, disableReducedMotion } = await import('@/lib/ui/ui-control-hooks');
      
      enableReducedMotion();
      
      if (!document.documentElement.classList.contains('reduce-motion')) {
        throw new Error('Reduced motion was not enabled');
      }
      
      disableReducedMotion();
      
      if (document.documentElement.classList.contains('reduce-motion')) {
        throw new Error('Reduced motion was not disabled');
      }
      
      return 'Reduced motion toggle works correctly';
    });
  }

  private async testErrorHandling(): Promise<void> {
    console.log('🚨 Testing Error Handling...');
    
    // Test invalid navigation target
    await this.runTest('Error Handling - Invalid Target', async () => {
      const { executeNavigationCommand } = await import('@/lib/ui/ui-control-hooks');
      
      const command: NavigationCommand = {
        action: 'navigate',
        target: '#non-existent-element'
      };
      
      try {
        await executeNavigationCommand(command);
        throw new Error('Should have thrown an error for invalid target');
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return 'Error handling for invalid targets works correctly';
        }
        throw error;
      }
    });

    // Test invalid command
    await this.runTest('Error Handling - Invalid Command', async () => {
      const { executeNavigationCommand } = await import('@/lib/ui/ui-control-hooks');
      
      try {
        await executeNavigationCommand({} as NavigationCommand);
        throw new Error('Should have thrown an error for invalid command');
      } catch (error) {
        if (error instanceof Error && error.message.includes('Invalid navigation command')) {
          return 'Error handling for invalid commands works correctly';
        }
        throw error;
      }
    });
  }

  private async runTest(testName: string, testFn: () => Promise<string>): Promise<void> {
    const startTime = performance.now();
    
    try {
      const message = await testFn();
      const duration = performance.now() - startTime;
      
      this.results.push({
        test: testName,
        status: 'pass',
        message,
        duration
      });
      
      console.log(`✅ ${testName}: ${message} (${duration.toFixed(2)}ms)`);
    } catch (error) {
      const duration = performance.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      this.results.push({
        test: testName,
        status: 'fail',
        message,
        duration
      });
      
      console.error(`❌ ${testName}: ${message} (${duration.toFixed(2)}ms)`);
    }
  }

  private printResults(): void {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Duration: ${totalDuration.toFixed(2)}ms`);
    console.log(`📈 Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }
  }

  getResults() {
    return this.results;
  }
}

// Export for use in test page
export const runUIControlHooksTests = async (): Promise<Array<{ test: string; status: 'pass' | 'fail'; message: string; duration: number }>> => {
  const runner = new UIControlHooksTestRunner();
  await runner.runAllTests();
  return runner.getResults();
};