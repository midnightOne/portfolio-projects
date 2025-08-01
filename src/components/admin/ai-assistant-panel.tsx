'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Briefcase, Smile, Tag, Wand2, Send, Loader2 } from 'lucide-react';
import { ProjectWithRelations, TextSelection } from '@/lib/types/project';

interface AIQuickAction {
  id: string;
  label: string;
  prompt: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresSelection: boolean;
}

const DEFAULT_QUICK_ACTIONS: AIQuickAction[] = [
  {
    id: 'improve-professional',
    label: 'Make Professional',
    prompt: 'Rewrite this text in a professional tone while preserving all original content and meaning',
    icon: Briefcase,
    requiresSelection: true
  },
  {
    id: 'improve-casual',
    label: 'Make Casual',
    prompt: 'Rewrite this text in a casual, friendly tone while preserving all original content',
    icon: Smile,
    requiresSelection: true
  },
  {
    id: 'add-tags',
    label: 'Suggest Tags',
    prompt: 'Based on this project content, suggest relevant tags that accurately describe the technologies, skills, and project type',
    icon: Tag,
    requiresSelection: false
  },
  {
    id: 'enhance-content',
    label: 'Enhance Content',
    prompt: 'Improve this content by making it more engaging and detailed while preserving the original meaning',
    icon: Wand2,
    requiresSelection: true
  }
];

interface AIAssistantPanelProps {
  project: ProjectWithRelations;
  selectedText?: TextSelection;
  onApplyChanges: (changes: Partial<ProjectWithRelations>) => void;
  onTextSelection: (selection: TextSelection | undefined) => void;
  isEnabled: boolean;
  height?: number;
  className?: string;
}

export function AIAssistantPanel({
  project,
  selectedText,
  onApplyChanges,
  onTextSelection,
  isEnabled,
  height = 600,
  className = ''
}: AIAssistantPanelProps) {
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const handleQuickAction = async (action: AIQuickAction) => {
    if (action.requiresSelection && !selectedText) {
      alert('Please select some text first');
      return;
    }

    await sendPrompt(action.prompt);
  };

  const handleCustomPrompt = async () => {
    if (!customPrompt.trim()) return;
    
    await sendPrompt(customPrompt);
    setCustomPrompt('');
  };

  const sendPrompt = async (prompt: string) => {
    try {
      setIsProcessing(true);
      
      // Add user message
      const userMessage = { role: 'user' as const, content: prompt };
      setMessages(prev => [...prev, userMessage]);

      // TODO: Implement actual AI API call
      // For now, just simulate a response
      setTimeout(() => {
        const mockResponse = {
          role: 'assistant' as const,
          content: `I would help you with: "${prompt}"\n\nThis is a placeholder response. The actual AI integration will be implemented in task 9.12.`
        };
        setMessages(prev => [...prev, mockResponse]);
        setIsProcessing(false);
      }, 1000);

    } catch (error) {
      console.error('AI request failed:', error);
      setIsProcessing(false);
    }
  };

  if (!isEnabled) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-gray-500">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>AI Assistant is disabled</p>
          <p className="text-sm">Enable in settings to get writing help</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`} style={{ height: `${height}px` }}>
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5" />
          AI Assistant
        </CardTitle>
        
        {/* Model Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Model</label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden">
        {/* Selected Text Display */}
        {selectedText && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex-shrink-0">
            <p className="text-xs text-blue-600 font-medium mb-1">Selected Text:</p>
            <p className="text-sm text-blue-800 italic">"{selectedText.text}"</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-2 flex-shrink-0">
          <label className="text-sm font-medium">Quick Actions</label>
          <div className="grid grid-cols-1 gap-2">
            {DEFAULT_QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              const isDisabled = action.requiresSelection && !selectedText;
              
              return (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action)}
                  disabled={isDisabled || isProcessing}
                  className="justify-start h-8 text-xs"
                >
                  <Icon className="h-3 w-3 mr-2" />
                  {action.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select text and use quick actions, or type a custom prompt below</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg text-sm ${
                  message.role === 'user'
                    ? 'bg-blue-100 text-blue-900 ml-4'
                    : 'bg-gray-100 text-gray-900 mr-4'
                }`}
              >
                <div className="font-medium mb-1">
                  {message.role === 'user' ? 'You' : 'AI Assistant'}
                </div>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            ))
          )}
          
          {isProcessing && (
            <div className="bg-gray-100 text-gray-900 mr-4 p-3 rounded-lg text-sm">
              <div className="font-medium mb-1 flex items-center gap-2">
                AI Assistant
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
              <div>Thinking...</div>
            </div>
          )}
        </div>

        {/* Custom Prompt Input */}
        <div className="space-y-2 flex-shrink-0">
          <label className="text-sm font-medium">Custom Prompt</label>
          <div className="flex gap-2">
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Ask the AI to help with your content..."
              rows={2}
              className="text-sm"
              disabled={isProcessing}
            />
            <Button
              onClick={handleCustomPrompt}
              disabled={!customPrompt.trim() || isProcessing}
              size="sm"
              className="self-end"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </div>
  );
}