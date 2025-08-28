"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, Zap, DollarSign, Cpu, AlertTriangle } from 'lucide-react';

interface BudgetStatus {
  tokensRemaining?: number;
  spendRemaining: number;
  isExhausted: boolean;
  estimatedRequestsRemaining: number;
}

interface ReflinkInfo {
  id: string;
  code: string;
  recipientName?: string;
  tokenLimit?: number;
  tokensUsed: number;
  spendLimit?: number;
  spendUsed: number;
}

interface UsageSimulation {
  type: 'llm_request' | 'voice_generation' | 'voice_processing';
  tokens: number;
  cost: number;
  description: string;
}

const USAGE_PRESETS: UsageSimulation[] = [
  {
    type: 'llm_request',
    tokens: 100,
    cost: 0.01,
    description: 'Small Chat Request (100 tokens)',
  },
  {
    type: 'llm_request',
    tokens: 500,
    cost: 0.05,
    description: 'Medium Chat Request (500 tokens)',
  },
  {
    type: 'llm_request',
    tokens: 2000,
    cost: 0.20,
    description: 'Large Chat Request (2000 tokens)',
  },
  {
    type: 'voice_generation',
    tokens: 0,
    cost: 0.15,
    description: 'Voice Generation (TTS)',
  },
  {
    type: 'voice_processing',
    tokens: 300,
    cost: 0.08,
    description: 'Voice Processing (STT + LLM)',
  },
];

export function BudgetDrainingTest() {
  const searchParams = useSearchParams();
  const [reflink, setReflink] = useState<ReflinkInfo | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDraining, setIsDraining] = useState(false);
  const [lastUsage, setLastUsage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      loadReflinkData();
    }
  }, [searchParams]);

  const loadReflinkData = async () => {
    // Get reflink from URL params safely
    const reflinkCode = typeof window !== 'undefined' ? 
      new URLSearchParams(window.location.search).get('ref') : 
      searchParams?.get('ref');
      
    if (!reflinkCode) {
      setError('No reflink code found in URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Validate reflink to get current data
      const response = await fetch('/api/ai/reflink/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: reflinkCode }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate reflink');
      }

      const validation = await response.json();

      if (validation.valid && validation.reflink) {
        setReflink(validation.reflink);
        setBudgetStatus(validation.budgetStatus);
      } else {
        setError(`Invalid reflink: ${validation.reason || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to load reflink data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const simulateUsage = async (usage: UsageSimulation) => {
    if (!reflink) return;

    setIsDraining(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/reflink/simulate-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reflinkId: reflink.id,
          usageType: usage.type,
          tokens: usage.tokens,
          cost: usage.cost,
          modelUsed: 'gpt-4o-mini',
          endpoint: '/api/ai/test-usage',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to simulate usage');
      }

      const result = await response.json();
      setBudgetStatus(result.budgetStatus);
      setLastUsage(result.usage);

      // Update reflink data to reflect new usage
      setReflink(prev => prev ? {
        ...prev,
        tokensUsed: prev.tokensUsed + usage.tokens,
        spendUsed: prev.spendUsed + usage.cost,
      } : null);

      console.log('Usage simulated:', result);
    } catch (err) {
      console.error('Failed to simulate usage:', err);
      setError(err instanceof Error ? err.message : 'Failed to simulate usage');
    } finally {
      setIsDraining(false);
    }
  };

  const drainBudgetCompletely = async () => {
    if (!reflink || !budgetStatus) return;

    setIsDraining(true);
    setError(null);

    try {
      // Calculate how much budget remains and drain it
      const remainingSpend = budgetStatus.spendRemaining;
      const remainingTokens = budgetStatus.tokensRemaining || 0;

      if (remainingSpend > 0) {
        // Drain the spend budget
        await simulateUsage({
          type: 'llm_request',
          tokens: Math.min(remainingTokens, 1000),
          cost: remainingSpend,
          description: 'Complete Budget Drain',
        });
      } else if (remainingTokens > 0) {
        // Drain the token budget
        await simulateUsage({
          type: 'llm_request',
          tokens: remainingTokens,
          cost: 0.001,
          description: 'Complete Token Drain',
        });
      }
    } catch (err) {
      console.error('Failed to drain budget:', err);
      setError(err instanceof Error ? err.message : 'Failed to drain budget');
    } finally {
      setIsDraining(false);
    }
  };

  const resetBudget = async () => {
    if (!reflink) return;

    setIsLoading(true);
    setError(null);

    try {
      // This would typically require admin privileges
      // For testing, we'll just reload the original reflink data
      await loadReflinkData();
    } catch (err) {
      console.error('Failed to reset budget:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset budget');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading reflink data...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">Error:</div>
              <div className="text-sm">{error}</div>
            </AlertDescription>
          </Alert>
          <Button onClick={loadReflinkData} className="mt-3" variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!reflink || !budgetStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No reflink data available. Make sure you have a valid reflink in the URL.
          </div>
        </CardContent>
      </Card>
    );
  }

  const tokenProgress = reflink.tokenLimit 
    ? (reflink.tokensUsed / reflink.tokenLimit) * 100 
    : 0;

  const spendProgress = reflink.spendLimit 
    ? (reflink.spendUsed / reflink.spendLimit) * 100 
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Budget Draining Test
            {budgetStatus.isExhausted && (
              <Badge variant="destructive">EXHAUSTED</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Budget Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4" />
                Spend Budget
              </div>
              <div className="text-xs text-gray-600">
                ${reflink.spendUsed.toFixed(4)} / ${reflink.spendLimit?.toFixed(2) || '∞'}
              </div>
              {reflink.spendLimit && (
                <Progress value={spendProgress} className="h-2" />
              )}
              <div className="text-xs">
                Remaining: ${budgetStatus.spendRemaining.toFixed(4)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Cpu className="h-4 w-4" />
                Token Budget
              </div>
              <div className="text-xs text-gray-600">
                {reflink.tokensUsed.toLocaleString()} / {reflink.tokenLimit?.toLocaleString() || '∞'}
              </div>
              {reflink.tokenLimit && (
                <Progress value={tokenProgress} className="h-2" />
              )}
              <div className="text-xs">
                Remaining: {budgetStatus.tokensRemaining?.toLocaleString() || '∞'}
              </div>
            </div>
          </div>

          {/* Budget Status Alert */}
          {budgetStatus.isExhausted && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium text-red-700">Budget Exhausted!</div>
                <div className="text-sm text-red-600">
                  This reflink should now be invalid and features should be revoked.
                  Refresh the page to see the updated status.
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Last Usage */}
          {lastUsage && (
            <div className="p-3 bg-gray-50 rounded text-sm">
              <div className="font-medium">Last Simulated Usage:</div>
              <div>Type: {lastUsage.type}</div>
              <div>Tokens: {lastUsage.tokens}</div>
              <div>Cost: ${lastUsage.cost.toFixed(4)}</div>
            </div>
          )}

          {/* Usage Simulation Buttons */}
          <div className="space-y-2">
            <div className="font-medium text-sm">Simulate Usage:</div>
            <div className="grid grid-cols-1 gap-2">
              {USAGE_PRESETS.map((usage, index) => (
                <Button
                  key={index}
                  onClick={() => simulateUsage(usage)}
                  disabled={isDraining || budgetStatus.isExhausted}
                  variant="outline"
                  size="sm"
                  className="justify-start text-xs"
                >
                  {isDraining ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-3 w-3 mr-2" />
                  )}
                  {usage.description} - ${usage.cost.toFixed(3)}
                </Button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              onClick={drainBudgetCompletely}
              disabled={isDraining || budgetStatus.isExhausted}
              variant="destructive"
              size="sm"
            >
              {isDraining ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-2" />
              )}
              Drain Completely
            </Button>
            <Button
              onClick={loadReflinkData}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm space-y-2">
            <div className="font-medium">Testing Instructions:</div>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Use the buttons above to simulate different types of AI usage</li>
              <li>Watch the budget bars decrease with each simulated usage</li>
              <li>Click "Drain Completely" to exhaust the budget instantly</li>
              <li>Once exhausted, refresh the main test page to see revoked access</li>
              <li>The reflink should become invalid and features should be disabled</li>
              <li>Check the session status to confirm budget exhaustion messaging</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}