'use client';

import { useState, useEffect, useCallback } from 'react';
import '../../styles/novel-editor.css';
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

// Import necessary Tiptap extensions for minimal schema
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { NovelToolbar } from '../novel/toolbar/novel-toolbar';

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
  const [content, setContent] = useState<JSONContent>(() => {
    if (typeof initialContent === 'string') {
      // Convert plain text to Novel JSON format, preserving line breaks
      if (!initialContent.trim()) {
        return { type: 'doc', content: [] };
      }
      
      const paragraphs = initialContent.split('\n').map(paragraph => ({
        type: 'paragraph',
        content: paragraph.trim() ? [{ type: 'text', text: paragraph }] : []
      }));
      
      return {
        type: 'doc',
        content: paragraphs.length > 0 ? paragraphs : [
          { type: 'paragraph', content: [] }
        ]
      };
    }
    return initialContent || { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
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
  const handleSelectionChange = useCallback((editorInstance: any) => {
    if (!editorInstance) return;

    try {
      // Handle both editor instance and prosemirror view
      const state = editorInstance.state || editorInstance.editor?.state;
      if (!state) return;

      const { from, to } = state.selection;
      if (from === undefined || to === undefined || from === to) {
        setSelectedText(undefined);
        return;
      }

      const selectedContent = state.doc.textBetween(from, to);
      console.log('Selection detected:', { from, to, text: selectedContent }); // Debug log
      
      if (selectedContent.trim()) {
        setSelectedText({
          text: selectedContent,
          start: from,
          end: to
        });
        console.log('Selection set:', selectedContent); // Debug log
      } else {
        setSelectedText(undefined);
      }
    } catch (error) {
      console.warn('Selection tracking error:', error);
      setSelectedText(undefined);
    }
  }, []);

  // Apply AI changes to the editor
  const handleApplyAIChanges = useCallback((result: AIQuickActionResult | AIPromptResult) => {
    if (!editor || !result.changes) return;

    try {
      const { changes } = result;

      // Handle full content replacement
      if (changes.fullContent) {
        // Convert plain text to proper Novel format with paragraphs
        const paragraphs = changes.fullContent.split('\n').filter(p => p.trim()).map(paragraph => ({
          type: 'paragraph',
          content: [{ type: 'text', text: paragraph }]
        }));
        
        const newContent = {
          type: 'doc',
          content: paragraphs.length > 0 ? paragraphs : [
            { type: 'paragraph', content: [{ type: 'text', text: changes.fullContent }] }
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
    } catch (error) {
      console.warn('Error applying AI changes:', error);
      // Call parent handler anyway for metadata changes
      if (onApplyAIChanges) {
        onApplyAIChanges(result);
      }
    }
  }, [editor, selectedText, onApplyAIChanges]);

  // Update content when initialContent changes
  useEffect(() => {
    if (initialContent && typeof initialContent === 'string') {
      const paragraphs = initialContent.split('\n').map(paragraph => ({
        type: 'paragraph',
        content: paragraph.trim() ? [{ type: 'text', text: paragraph }] : []
      }));
      
      const newContent = {
        type: 'doc',
        content: paragraphs.length > 0 ? paragraphs : [
          { type: 'paragraph', content: [] }
        ]
      };
      setContent(newContent);
    } else if (initialContent && typeof initialContent === 'object') {
      setContent(initialContent);
    }
  }, [initialContent]);

  // Create minimal extensions that provide proper schema with 'doc' node
  const portfolioExtensions = [
    StarterKit,
    Placeholder.configure({
      placeholder: placeholder,
    }),
  ];

  if (!showAIPanel) {
    // Simple editor without AI panel
    return (
      <div className={className}>
        <EditorRoot>
          <NovelToolbar editor={editor} />
          <EditorContent
            initialContent={content}
            onUpdate={({ editor }: any) => {
              handleContentChange(editor.getJSON());
            }}
            onCreate={({ editor }: any) => {
              setEditor(editor);
              // Set up selection tracking with event listeners
              editor.on('selectionUpdate', () => {
                handleSelectionChange(editor);
              });
            }}
            onSelectionUpdate={({ editor }: any) => {
              handleSelectionChange(editor);
            }}
            editable={editable}
            className="min-h-[400px] w-full max-w-full focus:outline-none"
            extensions={portfolioExtensions}
            editorProps={{
              attributes: {
                class: 'novel-editor-content p-4 min-h-[400px] focus:outline-none',
                style: 'white-space: pre-wrap; word-wrap: break-word;'
              },
              handleDOMEvents: {
                mouseup: (view, event) => {
                  // Trigger selection change on mouse up
                  setTimeout(() => handleSelectionChange(view), 10);
                  return false;
                },
                keyup: (view, event) => {
                  // Trigger selection change on key up
                  setTimeout(() => handleSelectionChange(view), 10);
                  return false;
                }
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
                <NovelToolbar editor={editor} />
                <EditorContent
                  initialContent={content}
                  onUpdate={({ editor }: any) => {
                    handleContentChange(editor.getJSON());
                  }}
                  onCreate={({ editor }: any) => {
                    setEditor(editor);
                    // Set up selection tracking with event listeners
                    editor.on('selectionUpdate', () => {
                      handleSelectionChange(editor);
                    });
                    // Notify parent component about editor ready
                    if (onEditorReady) {
                      onEditorReady(editor);
                    }
                  }}
                  onSelectionUpdate={({ editor }: any) => {
                    handleSelectionChange(editor);
                  }}
                  editable={editable}
                  className="h-full w-full max-w-full focus:outline-none overflow-y-auto"
                  extensions={portfolioExtensions}
                  editorProps={{
                    attributes: {
                      class: 'novel-editor-content p-4 h-full focus:outline-none',
                      style: 'white-space: pre-wrap; word-wrap: break-word;'
                    },
                    handleDOMEvents: {
                      mouseup: (view, event) => {
                        // Trigger selection change on mouse up
                        setTimeout(() => handleSelectionChange(view), 10);
                        return false;
                      },
                      keyup: (view, event) => {
                        // Trigger selection change on key up
                        setTimeout(() => handleSelectionChange(view), 10);
                        return false;
                      }
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