'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Briefcase, 
  Smile, 
  Tag, 
  Wand2, 
  Expand, 
  Minimize2, 
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { UnifiedModelSelector } from './unified-model-selector';

export interface TextSelection {
  text: string;
  start: number;
  end: number;
}

export interface AIQuickAction {
  id: string;
  label: string;
  description: string;
  operation: 'make_professional' | 'make_casual' | 'expand' | 'summarize' | 'improve' | 'suggest_tags';
  icon: React.ComponentType<{ className?: string }>;
  requiresSelection: boolean;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray';
}

export interface AIQuickActionResult {
  success: boolean;
  changes: {
    fullContent?: string;
    partialUpdate?: {
      start: number;
      end: number;
      newText: string;
      reasoning: string;
    };
    suggestedTags?: {
      add: string[];
      remove: string[];
      reasoning: string;
    };
    suggestedTitle?: string;
    suggestedDescription?: string;
  };
  reasoning: string;
  confidence: number;
  warnings: string[];
  model: string;
  tokensUsed: number;
  cost: number;
}

export interface ProjectContext {
  title: string;
  description: string;
  existingTags: string[];
  fullContent: string;
}

interface AIQuickActionsProps {
  selectedText?: TextSelection;
  projectContext: ProjectContext;
  onApplyChanges: (result: AIQuickActionResult) => void;
  className?: string;
}

const QUICK_ACTIONS: AIQuickAction[] = [
  {
    id: 'make-professional',
    label: 'Make Professional',
    description: 'Rewrite in professional tone',
    operation: 'make_professional',
    icon: Briefcase,
    requiresSelection: true,
    color: 'blue'
  },
  {
    id: 'make-casual',
    label: 'Make Casual',
    description: 'Rewrite in friendly tone',
    operation: 'make_casual',
    icon: Smile,
    requiresSelection: true,
    color: 'green'
  },
  {
    id: 'expand-content',
    label: 'Expand',
    description: 'Add detail and context',
    operation: 'expand',
    icon: Expand,
    requiresSelection: true,
    color: 'purple'
  },
  {
    id: 'summarize',
    label: 'Summarize',
    description: 'Condense key information',
    operation: 'summarize',
    icon: Minimize2,
    requiresSelection: true,
    color: 'orange'
  },
  {
    id: 'improve-content',
    label: 'Improve',
    description: 'Enhance clarity and flow',
    operation: 'improve',
    icon: Wand2,
    requiresSelection: true,
    color: 'red'
  },
  {
    id: 'suggest-tags',
    label: 'Suggest Tags',
    description: 'Analyze content for relevant tags',
    operation: 'suggest_tags',
    icon: Tag,
    requiresSelection: false,
    color: 'gray'
  }
];

export function AIQuickActions({
  selectedText,
  projectContext,
  onApplyChanges,
  className = ''
}: AIQuickActionsProps) {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AIQuickActionResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleQuickAction = async (action: AIQuickAction) => {
    // Check if text selection is required
    if (action.requiresSelection && !selectedText) {
      alert('Please select some text first to use this action.');
      return;
    }

    // Check if model is selected
    if (!selectedModel) {
      alert('Please select an AI model first.');
      return;
    }

    setProcessingAction(action.id);
    setLastResult(null);
    setShowPreview(false);

    try {
      let endpoint: string;
      let requestBody: any;

      if (action.operation === 'suggest_tags') {
        endpoint = '/api/admin/ai/suggest-tags';
        requestBody = {
          model: selectedModel,
          projectTitle: projectContext.title,
          projectDescription: projectContext.description,
          articleContent: projectContext.fullContent,
          existingTags: projectContext.existingTags,
          maxSuggestions: 5
        };
      } else {
        endpoint = '/api/admin/ai/edit-content';
        requestBody = {
          model: selectedModel,
          operation: action.operation,
          content: selectedText ? selectedText.text : projectContext.fullContent,
          selectedText: selectedText ? {
            text: selectedText.text,
            start: selectedText.start,
            end: selectedText.end
          } : undefined,
          context: {
            projectTitle: projectContext.title,
            projectDescription: projectContext.description,
            existingTags: projectContext.existingTags,
            fullContent: projectContext.fullContent
          }
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: AIQuickActionResult = await response.json();
      
      setLastResult(result);
      setShowPreview(true);

    } catch (error) {
      console.error('AI quick action failed:', error);
      
      // Create error result
      const errorResult: AIQuickActionResult = {
        success: false,
        changes: {},
        reasoning: `Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        warnings: ['AI service is currently unavailable. Please try again later.'],
        model: selectedModel,
        tokensUsed: 0,
        cost: 0
      };
      
      setLastResult(errorResult);
      setShowPreview(true);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleApplyChanges = () => {
    if (lastResult && lastResult.success) {
      onApplyChanges(lastResult);
      setShowPreview(false);
      setLastResult(null);
    }
  };

  const handleDiscardChanges = () => {
    setShowPreview(false);
    setLastResult(null);
  };

  const getActionButtonColor = (color: AIQuickAction['color']) => {
    const colorMap = {
      blue: 'border-blue-200 hover:bg-blue-50 text-blue-700',
      green: 'border-green-200 hover:bg-green-50 text-green-700',
      purple: 'border-purple-200 hover:bg-purple-50 text-purple-700',
      orange: 'border-orange-200 hover:bg-orange-50 text-orange-700',
      red: 'border-red-200 hover:bg-red-50 text-red-700',
      gray: 'border-gray-200 hover:bg-gray-50 text-gray-700'
    };
    return colorMap[color];
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">AI Quick Actions</CardTitle>
          <div className="space-y-3">
            {/* Model Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">AI Model</label>
              <UnifiedModelSelector
                value={selectedModel}
                onValueChange={setSelectedModel}
                placeholder="Select an AI model..."
                className="w-full"
              />
            </div>

            {/* Selected Text Display */}
            {selectedText && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-600 font-medium mb-1">Selected Text:</p>
                <p className="text-sm text-blue-800 italic line-clamp-3">
                  "{selectedText.text}"
                </p>
                <p className="text-xs text-blue-500 mt-1">
                  {selectedText.text.length} characters selected
                </p>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              const isDisabled = action.requiresSelection && !selectedText;
              const isProcessing = processingAction === action.id;
              
              return (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action)}
                  disabled={isDisabled || isProcessing || !selectedModel}
                  className={`justify-start h-auto p-3 ${getActionButtonColor(action.color)} ${
                    isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex items-start gap-2 w-full">
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 mt-0.5" />
                    ) : (
                      <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="text-left">
                      <div className="font-medium text-sm">{action.label}</div>
                      <div className="text-xs opacity-75">{action.description}</div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>

          {/* Selection Required Notice */}
          {QUICK_ACTIONS.some(action => action.requiresSelection) && !selectedText && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-amber-800">
                  Select text in the editor to enable text-specific actions
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Results */}
      {showPreview && lastResult && (
        <Card className="border-2 border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              {lastResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              AI Results Preview
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Success/Error Status */}
            <div className="flex items-center justify-between">
              <Badge variant={lastResult.success ? "default" : "destructive"}>
                {lastResult.success ? 'Success' : 'Failed'}
              </Badge>
              <div className="text-sm text-gray-500">
                Model: {lastResult.model} • Tokens: {lastResult.tokensUsed} • Cost: ${lastResult.cost.toFixed(4)}
              </div>
            </div>

            {/* Reasoning */}
            <div>
              <p className="text-sm font-medium mb-1">AI Reasoning:</p>
              <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                {lastResult.reasoning}
              </p>
            </div>

            {/* Content Changes */}
            {lastResult.changes?.fullContent && (
              <div>
                <p className="text-sm font-medium mb-2">New Content:</p>
                <div className="bg-green-50 border border-green-200 rounded p-3 max-h-40 overflow-y-auto">
                  <p className="text-sm text-green-800 whitespace-pre-wrap">
                    {lastResult.changes.fullContent}
                  </p>
                </div>
              </div>
            )}

            {/* Partial Updates */}
            {lastResult.changes?.partialUpdate && (
              <div>
                <p className="text-sm font-medium mb-2">Text Replacement:</p>
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-sm text-green-800 whitespace-pre-wrap">
                    {lastResult.changes.partialUpdate.newText}
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    {lastResult.changes.partialUpdate.reasoning}
                  </p>
                </div>
              </div>
            )}

            {/* Tag Suggestions */}
            {lastResult.changes?.suggestedTags && (
              <div>
                <p className="text-sm font-medium mb-2">Tag Suggestions:</p>
                <div className="space-y-2">
                  {lastResult.changes.suggestedTags.add?.length > 0 && (
                    <div>
                      <p className="text-xs text-green-600 font-medium">Add Tags:</p>
                      <div className="flex flex-wrap gap-1">
                        {lastResult.changes.suggestedTags.add.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-green-700 border-green-300">
                            +{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {lastResult.changes.suggestedTags.remove?.length > 0 && (
                    <div>
                      <p className="text-xs text-red-600 font-medium">Remove Tags:</p>
                      <div className="flex flex-wrap gap-1">
                        {lastResult.changes.suggestedTags.remove.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-red-700 border-red-300">
                            -{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-600">
                    {lastResult.changes.suggestedTags.reasoning}
                  </p>
                </div>
              </div>
            )}

            {/* Warnings */}
            {lastResult.warnings.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1 text-amber-700">Warnings:</p>
                <ul className="text-sm text-amber-800 space-y-1">
                  {lastResult.warnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscardChanges}
              >
                Discard
              </Button>
              {lastResult.success && (
                <Button
                  size="sm"
                  onClick={handleApplyChanges}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Apply Changes
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}