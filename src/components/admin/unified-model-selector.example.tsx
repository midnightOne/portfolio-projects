'use client';

import { useState } from 'react';
import { UnifiedModelSelector } from './unified-model-selector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export function UnifiedModelSelectorExample() {
  const [selectedModel, setSelectedModel] = useState<string>('');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Model Selector</CardTitle>
          <CardDescription>
            Simple model selection without refresh button
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="basic-model">Select Model</Label>
            <UnifiedModelSelector
              value={selectedModel}
              onValueChange={setSelectedModel}
              placeholder="Choose an AI model..."
              className="w-full"
            />
          </div>
          {selectedModel && (
            <p className="text-sm text-muted-foreground">
              Selected: <code className="bg-muted px-1 py-0.5 rounded">{selectedModel}</code>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model Selector with Refresh</CardTitle>
          <CardDescription>
            Model selection with refresh button to reload available models
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refresh-model">Select Model</Label>
            <UnifiedModelSelector
              value={selectedModel}
              onValueChange={setSelectedModel}
              placeholder="Choose an AI model..."
              showRefreshButton={true}
              onRefresh={() => console.log('Models refreshed!')}
              className="w-full"
            />
          </div>
          {selectedModel && (
            <p className="text-sm text-muted-foreground">
              Selected: <code className="bg-muted px-1 py-0.5 rounded">{selectedModel}</code>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Disabled Model Selector</CardTitle>
          <CardDescription>
            Shows how the component appears when disabled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disabled-model">Select Model (Disabled)</Label>
            <UnifiedModelSelector
              value=""
              onValueChange={() => {}}
              placeholder="Model selection disabled..."
              disabled={true}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}