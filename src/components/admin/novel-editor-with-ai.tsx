'use client';

import { useState, useEffect, useCallback } from 'react';
import { EditorRoot, EditorContent, type EditorContentProps } from 'novel';
import { JSONContent } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Wand2, FileText, Tag as TagIcon } from 'lucide-react';
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

// Import basic Tiptap extensions for now
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { ImageCarousel } from '../novel/extensions/image-carousel';

export interface NovelContent {
  type: 'doc';
  content: JSONContent[];
}

interface NovelEditorWithAIProps {
  // Content
  initialContent?: NovelContent | string;
  onChange: (content: NovelContent) => void;
  
  // AI integration
  projectContext: ProjectContext;
  onApplyAIChanges?: (changes: AIQuickActionResult | AIPromptResult) => void;
  
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
  placeholder = "Start writing your project article...",
  className = "",
  editable = true,
  showAIPanel = true,
  aiPanelHeight = 600
}: NovelEditorWithAIProps) {
  const [content, setContent] = useState<JSONContent>(() => {
    if (typeof initialContent === 'string') {
      // Convert plain text to Novel JSON format
      return {
        type: 'doc',
        content: initialContent ? [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: initialContent }]
          }
        ] : []
      };
    }
    return initialContent || { type: 'doc', content: [] };
  });

  const [selectedText, setSelectedText] = useState<TextSelection | undefined>();
  const [aiMode, setAiMode] = useState<'quick-actions' | 'prompt-interface'>('quick-actions');
  const [editor, setEditor] = useState<any>(null);

  // Handle content changes
  const handleContentChange = useCallback((newContent: JSONContent) => {
    setContent(newContent);
    onChange(newContent as NovelContent);
  }, [onChange]);

  // Handle text selection for AI assistance
  const handleSelectionChange = useCallback((editor: any) => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) {
      setSelectedText(undefined);
      return;
    }

    const selectedContent = editor.state.doc.textBetween(from, to);
    setSelectedText({
      text: selectedContent,
      start: from,
      end: to
    });
  }, []);

  // Apply AI changes to the editor
  const handleApplyAIChanges = useCallback((result: AIQuickActionResult | AIPromptResult) => {
    if (!editor || !result.changes) return;

    const { changes } = result;

    // Handle full content replacement
    if (changes.fullContent) {
      const newContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: changes.fullContent }]
          }
        ]
      };
      editor.commands.setContent(newContent);
    }

    // Handle partial text replacement
    if (changes.partialUpdate && selectedText) {
      const { newText } = changes.partialUpdate;
      editor.chain()
        .focus()
        .setTextSelection({ from: selectedText.start, to: selectedText.end })
        .insertContent(newText)
        .run();
    }

    // Call parent handler for other changes (tags, metadata, etc.)
    if (onApplyAIChanges) {
      onApplyAIChanges(result);
    }
  }, [editor, selectedText, onApplyAIChanges]);

  // Update content when initialContent changes
  useEffect(() => {
    if (initialContent && typeof initialContent === 'string') {
      const newContent = {
        type: 'doc',
        content: initialContent ? [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: initialContent }]
          }
        ] : []
      };
      setContent(newContent);
    } else if (initialContent && typeof initialContent === 'object') {
      setContent(initialContent);
    }
  }, [initialContent]);

  // Configure basic extensions for Novel
  const portfolioExtensions = [
    StarterKit,
    Placeholder.configure({
      placeholder: placeholder,
    }),
    ImageCarousel,
  ];

  if (!showAIPanel) {
    // Simple editor without AI panel
    return (
      <div className={className}>
        <EditorRoot>
          <EditorContent
            initialContent={content}
            onUpdate={({ editor }: any) => {
              handleContentChange(editor.getJSON());
            }}
            onCreate={({ editor }: any) => {
              setEditor(editor);
            }}
            onSelectionUpdate={({ editor }: any) => {
              handleSelectionChange(editor);
            }}
            editable={editable}
            className="min-h-[400px] prose prose-lg dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full"
            extensions={portfolioExtensions}
            editorProps={{
              attributes: {
                placeholder: placeholder
              }
            }}
          />
        </EditorRoot>
      </div>
    );
  }

  // Editor with AI panel
  return (
    <div className={`flex gap-4 ${className}`}>
      {/* Novel Editor - 65% */}
      <div className="flex-1" style={{ flexBasis: '65%' }}>
        <Card className="h-full">
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
              <EditorRoot>
                <EditorContent
                  initialContent={content}
                  onUpdate={({ editor }: any) => {
                    handleContentChange(editor.getJSON());
                  }}
                  onCreate={({ editor }: any) => {
                    setEditor(editor);
                  }}
                  onSelectionUpdate={({ editor }: any) => {
                    handleSelectionChange(editor);
                  }}
                  editable={editable}
                  className="h-full prose prose-lg dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full h-full overflow-y-auto"
                  extensions={portfolioExtensions}
                  editorProps={{
                    attributes: {
                      placeholder: placeholder
                    }
                  }}
                />
              </EditorRoot>
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
              <p className="text-sm text-gray-600">
                Select text and use AI to improve your content
              </p>
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
                    if (editor) {
                      const newContent = {
                        type: 'doc',
                        content: [
                          {
                            type: 'paragraph',
                            content: [{ type: 'text', text: content }]
                          }
                        ]
                      };
                      editor.commands.setContent(newContent);
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