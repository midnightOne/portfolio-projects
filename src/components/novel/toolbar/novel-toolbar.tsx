'use client';

// import { useCurrentEditor } from '@tiptap/react'; // Not compatible with Novel's context
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline,
  Strikethrough,
  Code,
  Quote,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Link,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';

interface NovelToolbarProps {
  className?: string;
  editor?: any; // Tiptap editor instance
}

export function NovelToolbar({ className = '', editor }: NovelToolbarProps) {
  if (!editor) {
    return (
      <div className={`flex items-center gap-1 p-2 border-b bg-gray-50 ${className}`}>
        <div className="text-sm text-gray-500">Loading toolbar...</div>
      </div>
    );
  }

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    disabled = false, 
    children, 
    title 
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <Button
      variant={isActive ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`h-8 w-8 p-0 transition-colors ${
        isActive 
          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
          : 'hover:bg-gray-100'
      }`}
    >
      {children}
    </Button>
  );

  return (
    <div className={`flex items-center gap-1 p-2 border-b bg-white border-gray-200 overflow-x-auto shadow-sm ${className}`}>
      {/* Undo/Redo */}
      <div className="flex items-center gap-1 mr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Headings */}
      <div className="flex items-center gap-1 mr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          isActive={editor.isActive('paragraph')}
          title="Normal Text"
        >
          <span className="text-xs font-medium">P</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Text Formatting */}
      <div className="flex items-center gap-1 mr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="Inline Code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Lists and Blocks */}
      <div className="flex items-center gap-1 mr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Additional formatting */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => {
            const url = window.prompt('Enter URL:');
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          isActive={editor.isActive('link')}
          title="Add Link"
        >
          <Link className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}