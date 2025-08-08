'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useEditor, EditorContent, JSONContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Typography } from '@tiptap/extension-typography';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Focus } from '@tiptap/extension-focus';
import { Dropcursor } from '@tiptap/extension-dropcursor';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import { 
  ImageCarousel, 
  InteractiveEmbed, 
  DownloadButton, 
  ProjectReference,
  SlashCommands,
  SlashCommand
} from './extensions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Bot, 
  Wand2, 
  FileText, 
  Bold, 
  Italic, 
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  Highlighter,
  Table as TableIcon,
  CheckSquare,
  Minus,
  Images,
  Monitor,
  Download
} from 'lucide-react';
import { 
  AIQuickActions, 
  TextSelection, 
  ProjectContext, 
  AIQuickActionResult 
} from '../admin/ai-quick-actions';
import { 
  AIPromptInterface,
  AIPromptResult 
} from '../admin/ai-prompt-interface';

export interface TiptapContentData {
  type: 'doc';
  content: JSONContent[];
}

// Toolbar component
interface ToolbarProps {
  editor: any;
}

function Toolbar({ editor }: ToolbarProps) {
  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="flex items-center gap-1 p-2 border-b bg-gray-50/50 flex-wrap">
      {/* Text formatting */}
      <Button
        variant={editor.isActive('bold') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => {
          console.log('Bold clicked, editor available:', !!editor);
          editor.chain().focus().toggleBold().run();
        }}
        className="h-8 w-8 p-0"
      >
        <Bold className="h-4 w-4" />
      </Button>
      
      <Button
        variant={editor.isActive('italic') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className="h-8 w-8 p-0"
      >
        <Italic className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('code') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className="h-8 w-8 p-0"
      >
        <Code className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Headings */}
      <Button
        variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
        size="sm"
        onClick={() => {
          console.log('H1 clicked, editor available:', !!editor);
          console.log('Current selection:', editor.state.selection);
          editor.chain().focus().toggleHeading({ level: 1 }).run();
        }}
        className="h-8 w-8 p-0"
      >
        <Heading1 className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className="h-8 w-8 p-0"
      >
        <Heading2 className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className="h-8 w-8 p-0"
      >
        <Heading3 className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists */}
      <Button
        variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className="h-8 w-8 p-0"
      >
        <List className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className="h-8 w-8 p-0"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('blockquote') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className="h-8 w-8 p-0"
      >
        <Quote className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Text formatting */}
      <Button
        variant={editor.isActive('highlight') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className="h-8 w-8 p-0"
      >
        <Highlighter className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Links and Images */}
      <Button
        variant={editor.isActive('link') ? 'default' : 'ghost'}
        size="sm"
        onClick={addLink}
        className="h-8 w-8 p-0"
      >
        <LinkIcon className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={addImage}
        className="h-8 w-8 p-0"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Advanced features */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        className="h-8 w-8 p-0"
        title="Insert Table"
      >
        <TableIcon className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('taskList') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className="h-8 w-8 p-0"
        title="Task List"
      >
        <CheckSquare className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="h-8 w-8 p-0"
        title="Horizontal Rule"
      >
        <Minus className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface TiptapEditorWithAIProps {
  // Content
  content?: TiptapContentData | string;
  onChange: (content: TiptapContentData) => void;
  
  // AI integration
  projectContext: ProjectContext;
  onSelectionChange?: (selection: TextSelection | null) => void;
  
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

export function TiptapEditorWithAI({
  content,
  onChange,
  projectContext,
  onSelectionChange,
  onEditorReady,
  placeholder = "Start writing your project article...",
  className = "",
  editable = true,
  showAIPanel = true,
  aiPanelHeight = 600
}: TiptapEditorWithAIProps) {
  const [selectedText, setSelectedText] = useState<TextSelection | undefined>();
  const [aiMode, setAiMode] = useState<'quick-actions' | 'prompt-interface'>('quick-actions');

  // Convert content to proper format
  const getInitialContent = useCallback(() => {
    if (!content) {
      return { type: 'doc', content: [] };
    }
    
    if (typeof content === 'string') {
      // Convert plain text to Tiptap JSON
      const paragraphs = content.split('\n').filter(p => p.trim()).map(paragraph => ({
        type: 'paragraph',
        content: [{ type: 'text', text: paragraph }]
      }));
      
      return {
        type: 'doc',
        content: paragraphs.length > 0 ? paragraphs : [
          { type: 'paragraph', content: [] }
        ]
      };
    }
    
    return content;
  }, [content]);

  // Get portfolio-specific slash commands
  const getPortfolioCommands = useCallback((): SlashCommand[] => {
    return [
      {
        title: 'Image Carousel',
        description: 'Insert a carousel with multiple images.',
        searchTerms: ['gallery', 'slideshow', 'images', 'carousel'],
        icon: ({ className }) => <Images className={className} />,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertImageCarousel({
              images: [],
              autoPlay: false,
              showThumbnails: true,
            })
            .run();
        },
      },
      {
        title: 'Interactive Embed',
        description: 'Embed interactive content, WebXR, or iframe.',
        searchTerms: ['iframe', 'webxr', 'interactive', 'embed'],
        icon: ({ className }) => <Monitor className={className} />,
        command: ({ editor, range }) => {
          const url = prompt('Enter URL for interactive content:');
          if (url) {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertInteractiveEmbed({
                url,
                type: 'iframe',
                width: 800,
                height: 600,
                allowFullscreen: true,
              })
              .run();
          }
        },
      },
      {
        title: 'Download Button',
        description: 'Add a download button for files.',
        searchTerms: ['file', 'attachment', 'download'],
        icon: ({ className }) => <Download className={className} />,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertDownloadButton({
              files: [],
              label: 'Download',
              variant: 'single',
              style: 'primary',
            })
            .run();
        },
      },
      {
        title: 'Project Reference',
        description: 'Link to another project in your portfolio.',
        searchTerms: ['project', 'reference', 'link'],
        icon: ({ className }) => <LinkIcon className={className} />,
        command: ({ editor, range }) => {
          const projectId = prompt('Enter project ID or slug:');
          if (projectId) {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertProjectReference({
                projectId,
                style: 'card',
              })
              .run();
          }
        },
      },
    ];
  }, []);

  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Ensure all needed extensions are enabled
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
        // Disable default code block to use CodeBlockLowlight
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Typography,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Focus.configure({
        className: 'has-focus',
        mode: 'all',
      }),
      Dropcursor,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 hover:text-blue-800 underline cursor-pointer',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight: createLowlight(),
        HTMLAttributes: {
          class: 'bg-gray-100 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm overflow-x-auto',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full border border-gray-300',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-gray-300',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 px-4 py-2 bg-gray-50 font-semibold text-left',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 px-4 py-2',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'not-prose pl-2',
        },
      }),
      TaskItem.configure({
        HTMLAttributes: {
          class: 'flex items-start my-4',
        },
        nested: true,
      }),
      // Portfolio-specific extensions
      ImageCarousel,
      InteractiveEmbed,
      DownloadButton,
      ProjectReference.configure({
        validateProject: async (projectId: string) => {
          // TODO: Implement project validation
          try {
            const response = await fetch(`/api/projects/${projectId}`);
            return response.ok;
          } catch {
            return false;
          }
        },
      }),
      // Slash commands for portfolio content
      SlashCommands.configure({
        suggestion: {
          items: ({ query }) => {
            const commands = getPortfolioCommands();
            return commands.filter(command =>
              command.title.toLowerCase().includes(query.toLowerCase()) ||
              command.description.toLowerCase().includes(query.toLowerCase()) ||
              command.searchTerms.some(term => 
                term.toLowerCase().includes(query.toLowerCase())
              )
            );
          },
        },
      }),
    ],
    content: getInitialContent(),
    editable,
    immediatelyRender: false, // Fix SSR hydration issues
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      onChange(json as TiptapContentData);
    },
    onSelectionUpdate: ({ editor }) => {
      handleSelectionChange(editor);
    },
    onCreate: ({ editor }) => {
      onEditorReady?.(editor);
    },
  });

  // Handle text selection for AI assistance
  const handleSelectionChange = useCallback((editor: any) => {
    if (!editor) return;

    try {
      const state = editor.state;
      if (!state) return;

      const { from, to } = state.selection;
      if (from === undefined || to === undefined || from === to) {
        setSelectedText(undefined);
        onSelectionChange?.(null);
        return;
      }

      const selectedContent = state.doc.textBetween(from, to);
      
      if (selectedContent.trim()) {
        const selection: TextSelection = {
          text: selectedContent,
          start: from,
          end: to
        };
        setSelectedText(selection);
        onSelectionChange?.(selection);
      } else {
        setSelectedText(undefined);
        onSelectionChange?.(null);
      }
    } catch (error) {
      console.warn('Selection tracking error:', error);
      setSelectedText(undefined);
      onSelectionChange?.(null);
    }
  }, [onSelectionChange]);

  // Apply AI changes to the editor
  const handleApplyAIChanges = useCallback((result: AIQuickActionResult | AIPromptResult) => {
    if (!editor || !result.changes) return;

    try {
      const { changes } = result;

      // Handle full content replacement
      if (changes.fullContent) {
        // Convert plain text to Tiptap JSON
        const paragraphs = changes.fullContent.split('\n').filter(p => p.trim()).map(paragraph => ({
          type: 'paragraph',
          content: [{ type: 'text', text: paragraph }]
        }));
        
        const newContent = {
          type: 'doc',
          content: paragraphs.length > 0 ? paragraphs : [
            { type: 'paragraph', content: [] }
          ]
        };
        
        editor.commands.setContent(newContent);
      }
      
      // Handle partial content updates
      if (changes.partialUpdate && selectedText) {
        const { start, end, newText } = changes.partialUpdate;
        
        editor.chain()
          .focus()
          .setTextSelection({ from: start, to: end })
          .insertContent(newText)
          .run();
      }

      // Apply metadata changes via parent callback (handled by parent component)
    } catch (error) {
      console.error('Failed to apply AI changes:', error);
    }
  }, [editor, selectedText]);

  // Update content when prop changes
  useEffect(() => {
    if (editor && content) {
      const newContent = getInitialContent();
      const currentContent = editor.getJSON();
      
      // Only update if content actually changed
      if (JSON.stringify(currentContent) !== JSON.stringify(newContent)) {
        editor.commands.setContent(newContent);
      }
    }
  }, [editor, content, getInitialContent]);

  if (!showAIPanel) {
    // Simple editor without AI panel
    return (
      <div className={className}>
        <div className="border rounded-lg overflow-hidden">
          <Toolbar editor={editor} />
          <EditorContent 
            editor={editor} 
            className="min-h-[400px] w-full max-w-full p-4 [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:focus:ring-0 [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_p]:mb-3 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-gray-300 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_code]:bg-gray-100 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-sm"
          />
        </div>
      </div>
    );
  }

  // Editor with AI panel
  return (
    <div className={`flex gap-4 ${className}`}>
      {/* Tiptap Editor - 65% */}
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
          <CardContent className="flex-1 overflow-hidden p-0">
            <div className="h-full flex flex-col">
              <Toolbar editor={editor} />
              <div className="flex-1 min-h-[500px] overflow-y-auto">
                <EditorContent 
                  editor={editor} 
                  className="h-full w-full max-w-full p-4 [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:focus:ring-0 [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_p]:mb-3 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-gray-300 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_code]:bg-gray-100 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-sm"
                />
              </div>
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
                      const paragraphs = content.split('\n').filter(p => p.trim()).map(paragraph => ({
                        type: 'paragraph',
                        content: [{ type: 'text', text: paragraph }]
                      }));
                      
                      const newContent = {
                        type: 'doc',
                        content: paragraphs.length > 0 ? paragraphs : [
                          { type: 'paragraph', content: [] }
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