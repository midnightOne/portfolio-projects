'use client';

import React, { useState, useEffect } from 'react';
import { passiveFIDManager, type FIDContext } from '@/lib/ai/tools';
import { type UIState } from '@/lib/ai/tools/types';

export default function TestPassiveFIDPage() {
  const [context, setContext] = useState<FIDContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [userIntent, setUserIntent] = useState('');

  const testUIStates = [
    {
      name: 'Home Page',
      state: {
        breadcrumbPath: 'home',
        visibleAnchors: ['hero', 'featured-projects'],
        currentRoute: 'home'
      } as UIState
    },
    {
      name: 'Projects Page',
      state: {
        breadcrumbPath: 'projects',
        visibleAnchors: ['project-grid'],
        currentRoute: 'projects'
      } as UIState
    },
    {
      name: 'E-commerce Platform Project',
      state: {
        breadcrumbPath: 'projects.e-commerce-platform',
        visibleAnchors: ['technical-details', 'implementation'],
        currentRoute: 'projects',
        currentProject: 'e-commerce-platform'
      } as UIState
    },
    {
      name: 'About Page',
      state: {
        breadcrumbPath: 'about',
        visibleAnchors: ['bio', 'experience'],
        currentRoute: 'about'
      } as UIState
    }
  ];

  const fetchContext = async (uiState: UIState, testName: string) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`🧪 Testing: ${testName}`);
      const startTime = Date.now();
      
      const result = await passiveFIDManager.getOrFetchContext(uiState);
      const loadTime = Date.now() - startTime;
      
      console.log(`✅ Context loaded in ${loadTime}ms`);
      console.log('Context:', result);
      
      setContext(result);
      setCacheStats(passiveFIDManager.getCacheStats());
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSetIntent = () => {
    if (userIntent.trim()) {
      passiveFIDManager.setUserIntent(userIntent.trim());
      console.log(`🎯 User intent set: ${userIntent.trim()}`);
    }
  };

  const handleClearCache = (projectId?: string) => {
    passiveFIDManager.clearCache(projectId);
    setCacheStats(passiveFIDManager.getCacheStats());
    console.log(`🗑️ Cache cleared${projectId ? ` for project: ${projectId}` : ' (all)'}`);
  };

  useEffect(() => {
    // Initial cache stats
    setCacheStats(passiveFIDManager.getCacheStats());
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          PassiveFIDManager Test Interface
        </h1>

        {/* User Intent Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Intent</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={userIntent}
              onChange={(e) => setUserIntent(e.target.value)}
              placeholder="Enter user intent (e.g., 'Show me technical projects')"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSetIntent}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Set Intent
            </button>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test UI States</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {testUIStates.map((test, index) => (
              <button
                key={index}
                onClick={() => fetchContext(test.state, test.name)}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {test.name}
              </button>
            ))}
          </div>
        </div>

        {/* Cache Management */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Cache Management</h2>
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => handleClearCache()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Clear All Cache
            </button>
            <button
              onClick={() => handleClearCache('e-commerce-platform')}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              Clear E-commerce Cache
            </button>
          </div>
          
          {cacheStats && (
            <div className="bg-gray-100 rounded p-4">
              <h3 className="font-medium mb-2">Cache Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Size:</span> {cacheStats.size}/{cacheStats.maxSize}
                </div>
                <div>
                  <span className="font-medium">Hit Rate:</span> {(cacheStats.hitRate * 100).toFixed(1)}%
                </div>
                <div>
                  <span className="font-medium">Memory:</span> {cacheStats.memoryUsage}
                </div>
                <div>
                  <span className="font-medium">Oldest:</span> {new Date(cacheStats.oldestEntry).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-blue-800">Loading F-I-D context...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-medium">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Context Display */}
        {context && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">F-I-D Context</h2>
            
            {/* Frame Context */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-blue-600 mb-2">Frame Context</h3>
              <div className="bg-blue-50 rounded p-4">
                <div className="grid gap-2">
                  <div>
                    <span className="font-medium">Portfolio Owner:</span> {context.frame.portfolioOwner}
                  </div>
                  <div>
                    <span className="font-medium">Capabilities:</span> {context.frame.currentCapabilities.join(', ')}
                  </div>
                  <div>
                    <span className="font-medium">UI Context:</span> {context.frame.uiContext}
                  </div>
                </div>
              </div>
            </div>

            {/* Index Context */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-green-600 mb-2">Index Context</h3>
              <div className="bg-green-50 rounded p-4">
                <div className="grid gap-2">
                  <div>
                    <span className="font-medium">Route:</span> {context.index.route}
                  </div>
                  <div>
                    <span className="font-medium">Current Project:</span> {context.index.currentProject || 'None'}
                  </div>
                  <div>
                    <span className="font-medium">Available Projects:</span> {context.index.availableProjects.length}
                  </div>
                  <div>
                    <span className="font-medium">Visible Sections:</span> {context.index.visibleSections.join(', ') || 'None'}
                  </div>
                </div>
                
                {context.index.availableProjects.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Projects:</h4>
                    <div className="space-y-2">
                      {context.index.availableProjects.slice(0, 10).map((project, idx) => (
                        <div key={idx} className="bg-white rounded p-2 text-sm">
                          <div className="font-medium">{project.title}</div>
                          <div className="text-gray-600">{project.description}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Technologies: {project.technologies.join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Details Context */}
            <div>
              <h3 className="text-lg font-medium text-purple-600 mb-2">Details Context</h3>
              <div className="bg-purple-50 rounded p-4">
                <div className="grid gap-2">
                  <div>
                    <span className="font-medium">Project Summary:</span> {context.details.projectSummary ? 'Available' : 'None'}
                  </div>
                  <div>
                    <span className="font-medium">Intent-based Content:</span> {context.details.intentBasedContent?.length || 0} items
                  </div>
                  <div>
                    <span className="font-medium">Selected Text:</span> {context.details.selectedText || 'None'}
                  </div>
                </div>

                {context.details.projectSummary && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Project Summary:</h4>
                    <div className="bg-white rounded p-2 text-sm">
                      {context.details.projectSummary.substring(0, 200)}...
                    </div>
                  </div>
                )}

                {context.details.intentBasedContent && context.details.intentBasedContent.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Intent-based Content:</h4>
                    <div className="space-y-2">
                      {context.details.intentBasedContent.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="bg-white rounded p-2 text-sm">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-gray-600">{item.oneLiner}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Score: {item.score.toFixed(3)} | Tech: {item.facets.tech.join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}