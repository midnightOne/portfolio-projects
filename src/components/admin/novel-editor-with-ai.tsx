'use client';

import { useState, useCallback, useRef } from 'react';
import '../../styles/novel-editor.css';
import { JSONContent } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Wand2, FileText } from 'lucide-react';
import { 
  AIQuickActions, 
  TextSelection, 
  ProjectContext, 
  AIQuickActionResult 
} from './ai-quick-actions';
import { 
  AIPromptInterface,
  AIPromptResult 
} from './ai-prompt-interface';
import { NovelContent, NovelContentRef } from '../novel/novel-content';
import { processContent } from '@/lib/novel/content-processor';

export interface NovelContentData {
  type: 'doc';
  content: JSONContent[];
}

interface NovelEditorWithAIProps {
  // Content
  initialContent?: NovelContentData | string;
  onChange: (content: NovelContentData) => void;
  
  // AI integration
  projectContext: ProjectContext;
  onApplyAIChanges?: (changes: AIQuickActionResult | AIPromptResult) => void;
  
  // Editor instance
  onEditorReady?: (editor: any) => void;
  
  // Display
  placeholder?: string;
  className?: string;
  editable?: boolean;
  
  // AI Panel
  showAIPanel?: boolean;
  aiPanelHeight?: number;
}

export function NovelEditorWithAI({
  initialContent,
  onChange,
  projectContext,
  onApplyAIChanges,
  onEditorReady,
  placeholder = "Start writing your project article...",
  className = "",
  editable = true,
  showAIPanel = true,
  aiPanelHeight = 600
}: NovelEditorWithAIProps) {
  const novelRef = useRef<NovelContentRef>(null);
  const [selectedText, setSelectedText] = useState<TextSelection | undefined>();
  const [aiMode, setAiMode] = useState<'quick-actions' | 'prompt-interface'>('quick-actions');

  // Handle content changes
  const handleContentChange = useCallback((newContent: JSONContent) => {
    onChange(newContent as NovelContentData);
  }, [onChange]);

  // Handle text selection for AI assistance
  const handleSelectionChange = useCallback((editor: any) => {
    if (!editor) return;

    try {
      const state = editor.state;
      if (!state) return;

      const { from, to } = state.selection;
      if (from === undefined || to === undefined || from === to) {
        setSelectedText(undefined);
        return;
      }

      const selectedContent = state.doc.textBetween(from, to);
      
      if (selectedContent.trim()) {
        setSelectedText({
          text: selectedContent,
          start: from,
          end: to
        });
      } else {
        setSelectedText(undefined);
      }
    } catch (error) {
      console.warn('Selection tracking error:', error);
      setSelectedText(undefined);
    }
  }, []);

  // Handle editor ready
  const handleEditorReady = useCallback((editor: any) => {
    onEditorReady?.(editor);
  }, [onEditorReady]);

  // Apply AI changes to the editor
  const handleApplyAIChanges = useCallback((result: AIQuickActionResult | AIPromptResult) => {
    if (!novelRef.current?.editor || !result.changes) return;

    try {
      const { changes } = result;
      const editor = novelRef.current.editor;

      // Handle full content replacement
      if (changes.fullContent) {
        const processed = processContent(changes.fullContent);
        novelRef.current.setContent(processed.json);
      }
      
      // Handle partial content updates
      if (changes.partialUpdate && selectedText) {
        const { start, end, content } = changes.partialUpdate;
        
        editor.commands.setTextSelection({ from: start, to: end });
        editor.commands.insertContent(content);
      }

      // Apply metadata changes via parent callback
      if (onApplyAIChanges) {
        onApplyAIChanges(result);
      }
    } catch (error) {
      console.error('Failed to apply AI changes:', error);
    }
  }, [selectedText, onApplyAIChanges]);

  if (!showAIPanel) {
    // Simple editor without AI panel
    return (
      <div className={className}>
        <NovelContent
          ref={novelRef}
          mode="editor"
          initialContent={initialContent}
          onChange={handleContentChange}
          onSelectionUpdate={handleSelectionChange}
          onReady={handleEditorReady}
          placeholder={placeholder}
          editable={editable}
          className="min-h-[400px] w-full max-w-full focus:outline-none"
          contentClassName="novel-editor-content p-4 min-h-[400px] focus:outline-none"
        />
      </div>
    );
  }

  // Editor with AI panel
  return (
    <div className={`flex gap-4 ${className}`}>
      {/* Novel Editor - 65% */}
      <div className="flex-1" style={{ flexBasis: '65%' }}>
        <Card className="h-full" style={{ height: `${aiPanelHeight}px` }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Article Content
            </CardTitle>
            <p className="text-sm text-gray-600">
              Write your project article with rich formatting. Select text to use AI assistance.
            </p>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <div className="h-full min-h-[500px]">
              <NovelContent
                ref={novelRef}
                mode="editor"
                initialContent={initialContent}
                onChange={handleContentChange}
                onSelectionUpdate={handleSelectionChange}
                onReady={handleEditorReady}
                placeholder={placeholder}
                editable={editable}
                className="h-full w-full max-w-full focus:outline-none overflow-y-auto"
                contentClassName="novel-editor-content p-4 h-full focus:outline-none"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Assistant Panel - 35% */}
      <div className="flex-shrink-0" style={{ flexBasis: '35%' }}>
        <Card className="h-full" style={{ height: `${aiPanelHeight}px` }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Assistant
            </CardTitle>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <p>Select text and use AI to improve your content</p>
                {selectedText && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Selected: "{selectedText.text.substring(0, 30)}{selectedText.text.length > 30 ? '...' : ''}"
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <Button
                  variant={aiMode === 'quick-actions' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setAiMode('quick-actions')}
                  className="h-7 px-2 text-xs"
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  Quick
                </Button>
                <Button
                  variant={aiMode === 'prompt-interface' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setAiMode('prompt-interface')}
                  className="h-7 px-2 text-xs"
                >
                  <Bot className="h-3 w-3 mr-1" />
                  Custom
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <div className="h-full">
              {aiMode === 'quick-actions' ? (
                <AIQuickActions
                  selectedText={selectedText}
                  projectContext={projectContext}
                  onApplyChanges={handleApplyAIChanges}
                  className="h-full"
                />
              ) : (
                <AIPromptInterface
                  selectedText={selectedText}
                  projectContext={projectContext}
                  onApplyChanges={handleApplyAIChanges}
                  onContentChange={(content) => {
                    // Handle content changes from AI prompt interface
                    if (novelRef.current) {
                      const processed = processContent(content);
                      novelRef.current.setContent(processed.json);
                    }
                  }}
                  className="h-full"
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}