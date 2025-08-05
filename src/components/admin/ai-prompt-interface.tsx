'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Bot, 
  Send, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Undo2,
  Redo2,
  X,
  Wand2
} from 'lucide-react';
import { UnifiedModelSelector } from './unified-model-selector';
import { AIStatusIndicator, AIUnavailableMessage } from './ai-status-indicator';
import { AIAvailabilityChecker } from '@/lib/ai/availability-checker';
import { useToast } from '@/components/ui/toast';
import { StatusBadge } from '@/components/ui/status-badge';
import { AsyncOperationIndicator } from '@/components/ui/loading-indicator';

export interface TextSelection {
  text: string;
  start: number;
  end: number;
}

export interface ProjectContext {
  title: string;
  description: string;
  existingTags: string[];
  fullContent: string;
}

export interface ContentSnapshot {
  content: string;
  prompt: string;
  timestamp: Date;
  reasoning?: string;
}

export interface AIPromptResult {
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
  userFeedback?: string;
}

interface AIPromptInterfaceProps {
  selectedText?: TextSelection;
  projectContext: ProjectContext;
  onApplyChanges: (result: AIPromptResult) => void;
  onContentChange?: (content: string) => void;
  className?: string;
}

export function AIPromptInterface({
  selectedText,
  projectContext,
  onApplyChanges,
  onContentChange,
  className = ''
}: AIPromptInterfaceProps) {
  const toast = useToast();
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  
  // State management
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<AIPromptResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(true);
  
  // Undo/Redo state
  const [snapshots, setSnapshots] = useState<ContentSnapshot[]>([]);
  const [currentSnapshotIndex, setCurrentSnapshotIndex] = useState(-1);
  
  // User feedback state
  const [userFeedback, setUserFeedback] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Check AI availability on component mount
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const checker = AIAvailabilityChecker.getInstance();
        const available = await checker.isAIEnabled();
        setAiAvailable(available);
      } catch (error) {
        console.error('Failed to check AI availability:', error);
        setAiAvailable(false);
      } finally {
        setCheckingAvailability(false);
      }
    };

    checkAvailability();
  }, []);

  // Create initial snapshot when component mounts
  useEffect(() => {
    if (snapshots.length === 0 && projectContext.fullContent) {
      const initialSnapshot: ContentSnapshot = {
        content: projectContext.fullContent,
        prompt: '',
        timestamp: new Date()
      };
      setSnapshots([initialSnapshot]);
      setCurrentSnapshotIndex(0);
    }
  }, [projectContext.fullContent, snapshots.length]);

  const handleCustomPrompt = async () => {
    if (!customPrompt.trim()) {
      toast.warning('Prompt required', 'Please enter a prompt to process');
      return;
    }

    if (!selectedModel) {
      toast.warning('Model selection required', 'Please select an AI model first');
      return;
    }

    // Create snapshot before processing
    createSnapshot(projectContext.fullContent, customPrompt);

    setIsProcessing(true);
    setLastResult(null);
    setShowPreview(false);
    setUserFeedback(null);
    setShowFeedback(false);

    try {
      const requestBody = {
        model: selectedModel,
        prompt: customPrompt,
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

      const response = await fetch('/api/admin/ai/process-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: AIPromptResult = await response.json();
      
      if (result.success) {
        toast.success(
          'AI prompt processed',
          'Review the changes and feedback below'
        );
        setLastResult(result);
        setShowPreview(true);
        
        // Show user feedback if provided
        if (result.userFeedback) {
          setUserFeedback(result.userFeedback);
          setShowFeedback(true);
        }
      } else {
        toast.error(
          'AI prompt failed',
          result.reasoning || 'The AI operation could not be completed'
        );
        setLastResult(result);
        setShowPreview(true);
      }

    } catch (error) {
      console.error('AI prompt processing failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(
        'AI service error',
        `Failed to process prompt: ${errorMessage}`
      );
      
      // Create error result for display
      const errorResult: AIPromptResult = {
        success: false,
        changes: {},
        reasoning: `Prompt processing failed: ${errorMessage}`,
        confidence: 0,
        warnings: ['AI service is currently unavailable. Please try again later.'],
        model: selectedModel,
        tokensUsed: 0,
        cost: 0
      };
      
      setLastResult(errorResult);
      setShowPreview(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyChanges = () => {
    if (lastResult && lastResult.success) {
      onApplyChanges(lastResult);
      setShowPreview(false);
      setCustomPrompt(''); // Clear prompt after applying
      toast.success('Changes applied', 'AI suggestions have been applied to your content');
    }
  };

  const handleDiscardChanges = () => {
    setShowPreview(false);
    setLastResult(null);
    setUserFeedback(null);
    setShowFeedback(false);
  };

  const createSnapshot = (content: string, prompt: string, reasoning?: string) => {
    const snapshot: ContentSnapshot = {
      content,
      prompt,
      timestamp: new Date(),
      reasoning
    };

    // Remove any snapshots after current index (linear undo/redo)
    const newSnapshots = snapshots.slice(0, currentSnapshotIndex + 1);
    newSnapshots.push(snapshot);
    
    setSnapshots(newSnapshots);
    setCurrentSnapshotIndex(newSnapshots.length - 1);
  };

  const handleUndo = () => {
    if (currentSnapshotIndex > 0) {
      const previousIndex = currentSnapshotIndex - 1;
      const previousSnapshot = snapshots[previousIndex];
      
      setCurrentSnapshotIndex(previousIndex);
      
      // Restore content
      if (onContentChange) {
        onContentChange(previousSnapshot.content);
      }
      
      // Restore prompt text for user modification
      setCustomPrompt(previousSnapshot.prompt);
      
      // Focus prompt input for editing
      setTimeout(() => {
        if (promptInputRef.current) {
          promptInputRef.current.focus();
          promptInputRef.current.setSelectionRange(
            previousSnapshot.prompt.length,
            previousSnapshot.prompt.length
          );
        }
      }, 100);
      
      toast.success('Undone', 'Previous state restored. You can modify the prompt and try again.');
    }
  };

  const handleRedo = () => {
    if (currentSnapshotIndex < snapshots.length - 1) {
      const nextIndex = currentSnapshotIndex + 1;
      const nextSnapshot = snapshots[nextIndex];
      
      setCurrentSnapshotIndex(nextIndex);
      
      // Restore content
      if (onContentChange) {
        onContentChange(nextSnapshot.content);
      }
      
      // Clear prompt field on redo
      setCustomPrompt('');
      
      toast.success('Redone', 'Next state restored');
    }
  };

  const dismissFeedback = () => {
    setUserFeedback(null);
    setShowFeedback(false);
  };

  const canUndo = currentSnapshotIndex > 0;
  const canRedo = currentSnapshotIndex < snapshots.length - 1;

  // Show loading state while checking availability
  if (checkingAvailability) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI Prompt Interface
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Checking AI availability...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show graceful degradation when AI is not available
  if (aiAvailable === false) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              AI Prompt Interface
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AIUnavailableMessage
              title="AI Features Disabled"
              message="AI prompt interface requires configuration to enable intelligent content assistance."
              showFallbacks={true}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* AI Status Indicator */}
      <AIStatusIndicator variant="compact" showActions={false} />
      
      {/* Persistent User Feedback */}
      {showFeedback && userFeedback && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Bot className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800 mb-1">AI Feedback</p>
                  <p className="text-sm text-blue-700">{userFeedback}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissFeedback}
                className="text-blue-600 hover:text-blue-800 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            AI Prompt Interface
          </CardTitle>
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
          {/* Undo/Redo Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={!canUndo || isProcessing}
              className="flex items-center gap-1"
            >
              <Undo2 className="h-3 w-3" />
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedo}
              disabled={!canRedo || isProcessing}
              className="flex items-center gap-1"
            >
              <Redo2 className="h-3 w-3" />
              Redo
            </Button>
            <div className="text-xs text-muted-foreground ml-2">
              {snapshots.length > 0 && (
                <>Step {currentSnapshotIndex + 1} of {snapshots.length}</>
              )}
            </div>
          </div>

          <Separator />

          {/* Custom Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom Prompt</label>
            <div className="space-y-2">
              <Textarea
                ref={promptInputRef}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Tell the AI what you want to do with your content... For example:
• Make this more engaging and add technical details
• Rewrite this in a professional tone for a job application
• Expand this section with examples and best practices
• Fix grammar and improve clarity"
                rows={4}
                className="text-sm resize-none"
                disabled={isProcessing}
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  {selectedText 
                    ? 'AI will process your selected text with this prompt'
                    : 'AI will process your entire article content with this prompt'
                  }
                </p>
                <Button
                  onClick={handleCustomPrompt}
                  disabled={!customPrompt.trim() || !selectedModel || isProcessing}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {isProcessing ? (
                    <AsyncOperationIndicator
                      isLoading={true}
                      operation="Processing"
                      className="flex-shrink-0"
                    />
                  ) : (
                    <>
                      <Send className="h-3 w-3" />
                      Process
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
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
              <div className="flex items-center gap-2">
                <StatusBadge 
                  status={lastResult.success ? 'success' : 'error'}
                  label={lastResult.success ? 'Completed' : 'Failed'}
                />
                <Badge variant="outline" className="text-xs">
                  Confidence: {Math.round(lastResult.confidence * 100)}%
                </Badge>
              </div>
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