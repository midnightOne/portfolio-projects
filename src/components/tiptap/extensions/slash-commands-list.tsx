'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  Image as ImageIcon,
  Images,
  Monitor,
  Download,
  Link,
  Type,
  List,
  Quote,
  Code,
  Minus,
  Table,
  CheckSquare
} from 'lucide-react';
import { SlashCommand } from './slash-commands';

interface SlashCommandsListProps {
  items: SlashCommand[];
  command: (item: SlashCommand) => void;
  editor: any;
  range: any;
}

export const SlashCommandsList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  SlashCommandsListProps
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  // Default commands that are always available
  const getDefaultCommands = (): SlashCommand[] => [
    {
      title: 'Text',
      description: 'Just start typing with plain text.',
      searchTerms: ['p', 'paragraph'],
      icon: Type,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleNode('paragraph', 'paragraph')
          .run();
      },
    },
    {
      title: 'Heading 1',
      description: 'Big section heading.',
      searchTerms: ['title', 'big', 'large'],
      icon: Type,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 1 })
          .run();
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading.',
      searchTerms: ['subtitle', 'medium'],
      icon: Type,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 2 })
          .run();
      },
    },
    {
      title: 'Heading 3',
      description: 'Small section heading.',
      searchTerms: ['subtitle', 'small'],
      icon: Type,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 3 })
          .run();
      },
    },
    {
      title: 'Bullet List',
      description: 'Create a simple bullet list.',
      searchTerms: ['unordered', 'point'],
      icon: List,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleBulletList()
          .run();
      },
    },
    {
      title: 'Numbered List',
      description: 'Create a list with numbering.',
      searchTerms: ['ordered'],
      icon: List,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleOrderedList()
          .run();
      },
    },
    {
      title: 'Quote',
      description: 'Capture a quote.',
      searchTerms: ['blockquote'],
      icon: Quote,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleBlockquote()
          .run();
      },
    },
    {
      title: 'Code',
      description: 'Capture a code snippet.',
      searchTerms: ['codeblock'],
      icon: Code,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleCodeBlock()
          .run();
      },
    },
    {
      title: 'Divider',
      description: 'Visually divide blocks.',
      searchTerms: ['horizontal rule', 'hr'],
      icon: Minus,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setHorizontalRule()
          .run();
      },
    },
    {
      title: 'Table',
      description: 'Insert a table.',
      searchTerms: ['grid'],
      icon: Table,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      title: 'Task List',
      description: 'Track tasks with a checklist.',
      searchTerms: ['todo', 'task', 'list', 'check', 'checkbox'],
      icon: CheckSquare,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleTaskList()
          .run();
      },
    },
  ];

  // Portfolio-specific commands
  const getPortfolioCommands = (): SlashCommand[] => [
    {
      title: 'Image',
      description: 'Insert a single image.',
      searchTerms: ['photo', 'picture', 'media'],
      icon: ImageIcon,
      command: ({ editor, range }) => {
        // TODO: Open image selection modal
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .run();
        
        // For now, insert a placeholder
        const url = prompt('Enter image URL:');
        if (url) {
          editor
            .chain()
            .focus()
            .setImage({ src: url })
            .run();
        }
      },
    },
    {
      title: 'Image Carousel',
      description: 'Insert a carousel with multiple images.',
      searchTerms: ['gallery', 'slideshow', 'images'],
      icon: Images,
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
      icon: Monitor,
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
      icon: Download,
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
      icon: Link,
      command: ({ editor, range }) => {
        // TODO: Open project selection modal
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

  // Combine all commands
  const allCommands = [...getDefaultCommands(), ...getPortfolioCommands()];

  // Use provided items or fall back to all commands
  const commands = props.items.length > 0 ? props.items : allCommands;

  return (
    <div className="slash-commands-list bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto p-1">
      {commands.length > 0 ? (
        commands.map((item, index) => (
          <button
            key={index}
            className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-3 hover:bg-gray-100 transition-colors ${
              index === selectedIndex ? 'bg-gray-100' : ''
            }`}
            onClick={() => selectItem(index)}
          >
            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
              <item.icon className="h-4 w-4 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900">
                {item.title}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {item.description}
              </div>
            </div>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-gray-500">
          No commands found
        </div>
      )}
    </div>
  );
});

SlashCommandsList.displayName = 'SlashCommandsList';