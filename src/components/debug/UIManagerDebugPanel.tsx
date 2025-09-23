'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UIManager } from '@/lib/navigation/UIManager';

interface NavigationTest {
  name: string;
  description: string;
  action: () => Promise<void>;
}

export function UIManagerDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<string>('');
  const [animationMode, setAnimationMode] = useState<'human' | 'instant'>('human');
  const [uiState, setUiState] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  const uiManager = UIManager.getInstance();

  // Ensure we're on the client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Add global hotkey for DescribeUI
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + D for DescribeUI
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        
        // Execute DescribeUI and log to console
        uiManager.describe().then(description => {
          console.group('🔍 UIManager DescribeUI - Hotkey Triggered (Ctrl+Shift+D)');
          console.log('📋 Full Description Object:', description);
          console.log('📊 Epoch:', description.epoch);
          console.log('🛣️  Route:', description.route);
          console.log('📚 View Stack:', description.viewStack);
          console.log('🎯 Available Sections:', description.sections);
          console.log('🔄 Available Transitions:', description.transitions);
          
          const currentState = uiManager.getCurrentUIState();
          console.group('🎛️  Current UI State Details');
          console.log('📍 Breadcrumb Path:', currentState.breadcrumbPath);
          console.log('👁️  Visible Anchors:', currentState.visibleAnchors);
          console.log('🔍 Active Filters:', currentState.activeFilters);
          console.log('📱 Modal Stack:', currentState.modalStack);
          console.log('🎬 Current Project:', currentState.currentProject);
          console.log('📜 Scroll State:', currentState.scrollPosition);
          console.log('🎥 Media State:', currentState.mediaState);
          console.log('🖱️  Interaction State:', currentState.interactionState);
          console.log('⚡ Last User Action:', currentState.lastUserAction);
          console.groupEnd();
          console.groupEnd();
        }).catch(error => {
          console.error('❌ DescribeUI hotkey failed:', error);
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update UI state when panel is open and periodically when executing
  useEffect(() => {
    if (!isOpen) return;

    const updateState = async () => {
      try {
        const state = uiManager.getCurrentUIState();
        const status = uiManager.getNavigationStatus();
        const description = await uiManager.describe();
        
        setUiState({
          ...state,
          navigationStatus: status,
          availableSections: description.sections,
          availableTransitions: description.transitions
        });
      } catch (error) {
        console.error('Failed to update UI state:', error);
      }
    };

    // Update immediately when panel opens
    updateState();
    
    // Update more frequently when executing, less frequently when idle
    const updateInterval = isExecuting ? 500 : 5000;
    const interval = setInterval(updateState, updateInterval);
    
    return () => clearInterval(interval);
  }, [isOpen, isExecuting]);

  const executeNavigation = async (action: () => Promise<void>) => {
    setIsExecuting(true);
    try {
      await action();
      setLastResult('✅ Navigation completed successfully');
    } catch (error) {
      setLastResult(`❌ Navigation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const navigationTests: NavigationTest[] = [
    // Homepage Section Navigation
    {
      name: 'Navigate to Hero',
      description: 'Scroll to hero section on homepage',
      action: async () => {
        const result = await uiManager.executeIntent({
          target: { type: 'section', id: 'hero' }
        });
        if (!result.success) throw new Error(result.message);
      }
    },
    {
      name: 'Navigate to About',
      description: 'Scroll to about section on homepage',
      action: async () => {
        const result = await uiManager.executeIntent({
          target: { type: 'section', id: 'about' }
        });
        if (!result.success) throw new Error(result.message);
      }
    },
    {
      name: 'Navigate to Projects',
      description: 'Scroll to projects section on homepage',
      action: async () => {
        const result = await uiManager.executeIntent({
          target: { type: 'section', id: 'projects' }
        });
        if (!result.success) throw new Error(result.message);
      }
    },
    {
      name: 'Navigate to Contact',
      description: 'Scroll to contact section on homepage',
      action: async () => {
        const result = await uiManager.executeIntent({
          target: { type: 'section', id: 'contact' }
        });
        if (!result.success) throw new Error(result.message);
      }
    },
    
    // Project Modal Tests
    {
      name: 'Open Project Modal',
      description: 'Open portfolio website project modal',
      action: async () => {
        const result = await uiManager.executeIntent({
          target: { type: 'project', id: 'portfolio-website' }
        });
        if (!result.success) throw new Error(result.message);
      }
    },
    {
      name: 'Project: Overview',
      description: 'Open e-commerce project modal (overview section)',
      action: async () => {
        const result = await uiManager.executeIntent({
          target: { type: 'project', id: 'e-commerce-platform', sectionId: 'overview' }
        });
        if (!result.success) throw new Error(result.message);
      }
    },
    {
      name: 'Project: Technical Details',
      description: 'Open e-commerce project modal (technical-details section)',
      action: async () => {
        const result = await uiManager.executeIntent({
          target: { type: 'project', id: 'e-commerce-platform', sectionId: 'technical-details' }
        });
        if (!result.success) throw new Error(result.message);
      }
    },
    {
      name: 'Project: Gallery',
      description: 'Open task management project modal (gallery section)',
      action: async () => {
        const result = await uiManager.executeIntent({
          target: { type: 'project', id: 'task-management-app', sectionId: 'gallery' }
        });
        if (!result.success) throw new Error(result.message);
      }
    },
    
    // Test Scenarios
    {
      name: 'Test Project Switch',
      description: 'Switch from current project to another with section',
      action: async () => {
        const result = await uiManager.testNavigationScenario('project-switch', animationMode);
        if (!result.success) throw new Error(result.message);
      }
    },
    {
      name: 'Test Section Navigation',
      description: 'Test section navigation scenario',
      action: async () => {
        const result = await uiManager.testNavigationScenario('section-navigation', animationMode);
        if (!result.success) throw new Error(result.message);
      }
    },
    {
      name: 'Test Modal Nesting',
      description: 'Test nested modal scenario',
      action: async () => {
        const result = await uiManager.testNavigationScenario('modal-nesting', animationMode);
        if (!result.success) throw new Error(result.message);
      }
    }
  ];

  if (!isMounted) {
    return null;
  }

  const debugPanelContent = (
    <>
      {!isOpen ? (
        <div className="fixed bottom-4 right-4 z-[99999]" style={{ zIndex: 99999 }}>
          <button
            onClick={() => setIsOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors"
            style={{ pointerEvents: 'auto' }}
          >
            🧭 UIManager Debug
          </button>
        </div>
      ) : (
        <div 
          className="fixed bottom-4 right-4 z-[99999] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-4 w-[28rem] max-h-[32rem] overflow-y-auto"
          style={{ zIndex: 99999, pointerEvents: 'auto' }}
        >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">🧭 UIManager Debug</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* Animation Mode Toggle */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Animation Mode:</label>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setAnimationMode('human');
              uiManager.setAnimationMode('human');
            }}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              animationMode === 'human' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Human (300ms)
          </button>
          <button
            onClick={() => {
              setAnimationMode('instant');
              uiManager.setAnimationMode('instant');
            }}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              animationMode === 'instant' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Instant (0ms)
          </button>
        </div>
      </div>

      {/* Current State */}
      {uiState && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded text-xs space-y-1">
          <div className="text-gray-700 dark:text-gray-300"><strong>Route:</strong> {uiState.navigationStatus?.currentRoute}</div>
          <div className="text-gray-700 dark:text-gray-300"><strong>Project:</strong> {uiState.navigationStatus?.currentProject || 'None'}</div>
          <div className="text-gray-700 dark:text-gray-300"><strong>Breadcrumb:</strong> {uiState.breadcrumbPath}</div>
          <div className="text-gray-700 dark:text-gray-300"><strong>Executing:</strong> {uiState.navigationStatus?.isExecuting ? '🔄' : '✅'}</div>
          <div className="text-gray-700 dark:text-gray-300"><strong>Sections:</strong> {uiState.availableSections?.length || 0}</div>
          {uiState.visibleAnchors?.length > 0 && (
            <div className="text-gray-700 dark:text-gray-300"><strong>Visible:</strong> {uiState.visibleAnchors.join(', ')}</div>
          )}
        </div>
      )}

      {/* Navigation Tests */}
      <div className="space-y-1">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Navigation Tests</h4>
        
        {/* Homepage Section Tests */}
        <div className="mb-3">
          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Homepage Sections</h5>
          {navigationTests.slice(0, 4).map((test, index) => (
            <div key={index} className="border border-gray-200 dark:border-gray-600 rounded p-2 mb-1 bg-white dark:bg-gray-800">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs text-gray-900 dark:text-white truncate">{test.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{test.description}</div>
                </div>
                <button
                  onClick={() => executeNavigation(test.action)}
                  disabled={isExecuting}
                  className={`ml-2 px-2 py-1 rounded text-xs transition-colors ${
                    isExecuting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isExecuting ? '⏳' : '▶️'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Project Modal Tests */}
        <div className="mb-3">
          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Project Modals</h5>
          {navigationTests.slice(4, 8).map((test, index) => (
            <div key={index + 4} className="border border-gray-200 dark:border-gray-600 rounded p-2 mb-1 bg-white dark:bg-gray-800">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs text-gray-900 dark:text-white truncate">{test.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{test.description}</div>
                </div>
                <button
                  onClick={() => executeNavigation(test.action)}
                  disabled={isExecuting}
                  className={`ml-2 px-2 py-1 rounded text-xs transition-colors ${
                    isExecuting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isExecuting ? '⏳' : '▶️'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Test Scenarios */}
        <div>
          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Test Scenarios</h5>
          {navigationTests.slice(8).map((test, index) => (
            <div key={index + 8} className="border border-gray-200 dark:border-gray-600 rounded p-2 mb-1 bg-white dark:bg-gray-800">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs text-gray-900 dark:text-white truncate">{test.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{test.description}</div>
                </div>
                <button
                  onClick={() => executeNavigation(test.action)}
                  disabled={isExecuting}
                  className={`ml-2 px-2 py-1 rounded text-xs transition-colors ${
                    isExecuting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {isExecuting ? '⏳' : '▶️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Last Result */}
      {lastResult && (
        <div className="mt-4 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
          <strong className="text-gray-700 dark:text-gray-300">Last Result:</strong>
          <div className="mt-1 text-gray-700 dark:text-gray-300">{lastResult}</div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-4 flex gap-2 flex-wrap">
        <button
          onClick={async () => {
            const description = await uiManager.describe();
            console.log('UIManager State:', description);
            setLastResult('📊 State logged to console');
          }}
          className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs transition-colors"
        >
          Log State
        </button>
        <button
          onClick={async () => {
            try {
              const uiDescription = await uiManager.describe();
              console.group('🔍 UIManager DescribeUI - Complete State');
              console.log('📋 Full Description Object:', uiDescription);
              console.log('📊 Epoch:', uiDescription.epoch);
              console.log('🛣️  Route:', uiDescription.route);
              console.log('📚 View Stack:', uiDescription.viewStack);
              console.log('🎯 Available Sections:', uiDescription.sections);
              console.log('🔄 Available Transitions:', uiDescription.transitions);
              
              // Get current UI state for additional context
              const currentState = uiManager.getCurrentUIState();
              console.group('🎛️  Current UI State Details');
              console.log('📍 Breadcrumb Path:', currentState.breadcrumbPath);
              console.log('👁️  Visible Anchors:', currentState.visibleAnchors);
              console.log('🔍 Active Filters:', currentState.activeFilters);
              console.log('📱 Modal Stack:', currentState.modalStack);
              console.log('🎬 Current Project:', currentState.currentProject);
              console.log('📜 Scroll State:', currentState.scrollPosition);
              console.log('🎥 Media State:', currentState.mediaState);
              console.log('🖱️  Interaction State:', currentState.interactionState);
              console.log('⚡ Last User Action:', currentState.lastUserAction);
              console.groupEnd();
              
              console.groupEnd();
              
              setLastResult('🔍 DescribeUI output logged to console');
            } catch (error) {
              console.error('❌ Failed to execute DescribeUI:', error);
              setLastResult('❌ DescribeUI failed - check console');
            }
          }}
          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
        >
          Describe UI
        </button>
        <button
          onClick={() => {
            uiManager.destroy();
            setLastResult('🔄 UIManager reset');
          }}
          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => {
            setLastResult('');
          }}
          className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs transition-colors"
        >
          Clear
        </button>
      </div>
        </div>
      )}
    </>
  );

  return createPortal(debugPanelContent, document.body);
}