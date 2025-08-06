/**
 * Simplified Novel Content Component for Editor Mode Only
 * Avoids Tiptap version conflicts by using Novel's own components
 */

'use client';

import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { EditorRoot, EditorContent, JSONContent } from 'novel';
import { processContent, sanitizeJSONContent } from '@/lib/novel/content-processor';
import { getEditorExtensions } from '@/lib/novel/extensions';

// Import toolbar for editor mode
import { NovelToolbar } from './toolbar/novel-toolbar';

export interface NovelContentProps {
  // Content
  initialContent?: JSONContent | string | null;
  
  // Mode - keeping for API compatibility but only editor mode works
  mode?: 'editor' | 'display';
  
  // Editor-specific props
  editable?: boolean;
  placeholder?: string;
  onChange?: (content: JSONContent) => void;
  onSelectionUpdate?: (editor: any) => void;
  
  // Styling
  className?: string;
  contentClassName?: string;
  
  // Events
  onReady?: (editor: any) => void;
  onUpdate?: (editor: any) => void;
  onFocus?: (editor: any) => void;
  onBlur?: (editor: any) => void;
}

export interface NovelContentRef {
  editor: any | null;
  getContent: () => JSONContent;
  setContent: (content: JSONContent | string) => void;
  focus: () => void;
  blur: () => void;
}

export const NovelContent = forwardRef<NovelContentRef, NovelContentProps>(({
  initialContent,
  mode = 'editor', // Only editor mode is fully supported
  editable = true,
  placeholder = 'Start writing...',
  onChange,
  onSelectionUpdate,
  className = '',
  contentClassName = '',
  onReady,
  onUpdate,
  onFocus,
  onBlur,
}, ref) => {
  const [editor, setEditor] = useState<any>(null);
  const [content, setContent] = useState<JSONContent>(() => {
    const processed = processContent(initialContent);
    return processed.json;
  });

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    editor,
    getContent: () => editor?.getJSON() || content,
    setContent: (newContent: JSONContent | string) => {
      const processed = processContent(newContent);
      const sanitized = sanitizeJSONContent(processed.json);
      setContent(sanitized);
      if (editor) {
        try {
          editor.commands.setContent(sanitized);
        } catch (error) {
          console.warn('Failed to set editor content:', error);
        }
      }
    },
    focus: () => editor?.commands.focus(),
    blur: () => editor?.commands.blur(),
  }), [editor, content]);

  // Update content when initialContent prop changes
  useEffect(() => {
    const processed = processContent(initialContent);
    const sanitized = sanitizeJSONContent(processed.json);
    
    setContent(sanitized);
    
    // Update editor if it exists
    if (editor && sanitized) {
      setTimeout(() => {
        try {
          editor.commands.setContent(sanitized);
        } catch (error) {
          console.warn('Failed to set editor content:', error);
        }
      }, 100);
    }
  }, [initialContent, editor]);

  // Handle content changes
  const handleContentChange = useCallback((newContent: JSONContent) => {
    const sanitized = sanitizeJSONContent(newContent);
    setContent(sanitized);
    onChange?.(sanitized);
  }, [onChange]);

  // Handle editor creation
  const handleEditorCreate = useCallback(({ editor }: { editor: any }) => {
    setEditor(editor);
    onReady?.(editor);
  }, [onReady]);

  // Handle editor updates
  const handleEditorUpdate = useCallback(({ editor }: { editor: any }) => {
    const newContent = editor.getJSON();
    handleContentChange(newContent);
    onUpdate?.(editor);
  }, [handleContentChange, onUpdate]);

  // Handle selection updates
  const handleSelectionUpdate = useCallback(({ editor }: { editor: any }) => {
    onSelectionUpdate?.(editor);
  }, [onSelectionUpdate]);

  // Handle focus
  const handleFocus = useCallback(({ editor }: { editor: any }) => {
    onFocus?.(editor);
  }, [onFocus]);

  // Handle blur
  const handleBlur = useCallback(({ editor }: { editor: any }) => {
    onBlur?.(editor);
  }, [onBlur]);

  // For display mode, show a warning - this should use the simple renderer
  if (mode === 'display') {
    console.warn('NovelContent display mode should use NovelDisplayRenderer instead');
    return (
      <div className={`${className} p-4 border border-yellow-300 bg-yellow-50`}>
        <p className="text-yellow-800">Display mode should use NovelDisplayRenderer component</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <EditorRoot>
        <div className="flex flex-col h-full">
          {/* Toolbar for editor mode */}
          <NovelToolbar editor={editor} />
          <EditorContent
            initialContent={content}
            onCreate={handleEditorCreate}
            onUpdate={handleEditorUpdate}
            onSelectionUpdate={handleSelectionUpdate}
            onFocus={handleFocus}
            onBlur={handleBlur}
            editable={editable}
            extensions={getEditorExtensions({ placeholder, editable })}
            editorProps={{
              attributes: {
                class: `novel-editor-content focus:outline-none ${contentClassName}`,
                style: 'white-space: pre-wrap; word-wrap: break-word;',
              },
              handleDOMEvents: {
                focus: () => false,
                blur: () => false,
              },
            }}
          />
        </div>
      </EditorRoot>
    </div>
  );
});

NovelContent.displayName = 'NovelContent';