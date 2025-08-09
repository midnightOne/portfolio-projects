/**
 * AI Status Indicator Component
 * 
 * Displays AI availability status and provides graceful degradation
 * when AI features are not available.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Settings, RefreshCw, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { AIAvailabilityChecker, AIAvailabilityStatus } from '@/lib/ai/availability-checker';

interface AIStatusIndicatorProps {
  variant?: 'compact' | 'detailed' | 'inline';
  showActions?: boolean;
  className?: string;
}

export const AIStatusIndicator: React.FC<AIStatusIndicatorProps> = ({
  variant = 'compact',
  showActions = true,
  className = ''
}) => {
  const [status, setStatus] = useState<AIAvailabilityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<any>(null);

  const checker = AIAvailabilityChecker.getInstance();

  const loadStatus = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const newStatus = await checker.checkAvailability(forceRefresh);
      setStatus(newStatus);
    } catch (error) {
      console.error('Failed to load AI status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      
      // Call the refresh endpoint to force fresh connection tests
      const response = await fetch('/api/admin/ai/providers/refresh', {
        method: 'POST',
        credentials: 'include', // Include session cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update status with fresh data
          await loadStatus(true);
          setCacheInfo(data.meta?.cacheStats);
        }
      } else {
        console.error('Failed to refresh AI status');
        // Fallback to regular status check
        await loadStatus(true);
      }
    } catch (error) {
      console.error('Error refreshing AI status:', error);
      // Fallback to regular status check
      await loadStatus(true);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && !status) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Checking AI status...</span>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  // Inline variant - minimal status indicator
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {status.available ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <Badge variant="default" className="text-xs">
              AI Active ({status.availableModels.length} models)
            </Badge>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <Badge variant="secondary" className="text-xs">
              AI Disabled
            </Badge>
          </>
        )}
      </div>
    );
  }

  // Compact variant - status with basic info
  if (variant === 'compact') {
    return (
      <Alert className={className}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.available ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-orange-500" />
            )}
            <div>
              <AlertTitle className="text-sm">
                {status.available ? 'AI Features Active' : 'AI Features Disabled'}
              </AlertTitle>
              <AlertDescription className="text-xs">
                {status.available 
                  ? `${status.availableModels.length} models available`
                  : status.unavailableReasons[0] || 'Configuration required'
                }
              </AlertDescription>
            </div>
          </div>
          
          {showActions && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              {!status.available && (
                <Button variant="outline" size="sm" asChild>
                  <a href="/admin/ai">
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </Alert>
    );
  }

  // Detailed variant - full status card
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.available ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-orange-500" />
            )}
            <CardTitle className="text-lg">
              {status.available ? 'AI Features Active' : 'AI Features Disabled'}
            </CardTitle>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        <CardDescription>
          {status.available 
            ? `AI assistance is working with ${status.availableModels.length} available models`
            : 'AI features require configuration to enable intelligent assistance'
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Summary */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-medium">Providers</div>
            <Badge variant={status.hasConfiguredProviders ? "default" : "secondary"}>
              {status.hasConfiguredProviders ? 'Configured' : 'Not Set'}
            </Badge>
          </div>
          <div className="text-center">
            <div className="font-medium">Connection</div>
            <Badge variant={status.hasConnectedProviders ? "default" : "secondary"}>
              {status.hasConnectedProviders ? 'Connected' : 'Offline'}
            </Badge>
          </div>
          <div className="text-center">
            <div className="font-medium">Models</div>
            <Badge variant={status.availableModels.length > 0 ? "default" : "secondary"}>
              {status.availableModels.length} Available
            </Badge>
          </div>
        </div>

        {/* Available Models */}
        {status.availableModels.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Available Models:</div>
            <div className="flex flex-wrap gap-1">
              {status.availableModels.map((model) => (
                <Badge key={model} variant="outline" className="text-xs">
                  {model}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Issues and Suggestions */}
        {!status.available && (
          <div className="space-y-3">
            {status.unavailableReasons.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2 text-orange-600">Issues:</div>
                <ul className="text-sm space-y-1">
                  {status.unavailableReasons.map((reason, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 mt-0.5 text-orange-500 flex-shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {status.suggestions.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Suggestions:</div>
                <ul className="text-sm space-y-1">
                  {status.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Cache Information (Development Only) */}
        {process.env.NODE_ENV === 'development' && cacheInfo && (
          <div className="pt-3 border-t">
            <div className="text-sm font-medium mb-2">Cache Statistics:</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Hit Rate: {(cacheInfo.hitRate * 100).toFixed(1)}%</div>
              <div>Total Requests: {cacheInfo.totalRequests}</div>
              <div>Cache Hits: {cacheInfo.cacheHits}</div>
              <div>Cache Misses: {cacheInfo.cacheMisses}</div>
            </div>
            {cacheInfo.lastRefresh && (
              <div className="text-xs text-muted-foreground mt-1">
                Last Refresh: {new Date(cacheInfo.lastRefresh).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" asChild>
              <a href="/admin/ai">
                <Settings className="h-4 w-4 mr-2" />
                AI Settings
              </a>
            </Button>
            
            {!status.hasConfiguredProviders && (
              <>
                <Button variant="outline" asChild>
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    OpenAI Keys
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Anthropic Keys
                  </a>
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * AI Unavailable Message Component
 * 
 * Shows when AI features are disabled with fallback options
 */
interface AIUnavailableMessageProps {
  title?: string;
  message?: string;
  showFallbacks?: boolean;
  className?: string;
}

export const AIUnavailableMessage: React.FC<AIUnavailableMessageProps> = ({
  title = 'AI Features Unavailable',
  message,
  showFallbacks = true,
  className = ''
}) => {
  const [guidance, setGuidance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGuidance = async () => {
      try {
        const checker = AIAvailabilityChecker.getInstance();
        const config = await checker.getConfigurationGuidance();
        setGuidance(config);
      } catch (error) {
        console.error('Failed to load AI guidance:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGuidance();
  }, []);

  if (loading) {
    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Loading...</AlertTitle>
        <AlertDescription>Checking AI availability...</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{message || guidance?.message || 'AI features are currently disabled.'}</p>
        
        {guidance?.actions && guidance.actions.length > 0 && (
          <div className="space-y-2">
            <div className="font-medium text-sm">Next steps:</div>
            <div className="space-y-2">
              {guidance.actions.map((action: any, index: number) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">
                    <div className="font-medium">{action.label}</div>
                    <div className="text-muted-foreground">{action.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showFallbacks && (
          <div className="pt-2 border-t">
            <div className="font-medium text-sm mb-2">Continue without AI:</div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>• Use manual editing tools</div>
              <div>• Save your work as draft</div>
              <div>• Return when AI is configured</div>
            </div>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default AIStatusIndicator;