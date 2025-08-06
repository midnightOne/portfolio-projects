import React from 'react';
import { 
  Images, 
  Download, 
  Folder, 
  Monitor,
  Heading1,
  Heading2,
  List,
  Quote,
  Code,
  Image
} from 'lucide-react';
import { createSuggestionItems, Command, renderItems } from 'novel/extensions';

export const portfolioSuggestionItems = createSuggestionItems([
  {
    title: 'Image Carousel',
    description: 'Insert a carousel with multiple images',
    searchTerms: ['carousel', 'images', 'gallery', 'slideshow'],
    icon: React.createElement(Images, { size: 18 }),
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertImageCarousel({
        images: [
          {
            src: 'https://via.placeholder.com/800x400?text=Image+1',
            alt: 'Sample image 1',
            caption: 'Add your image caption here'
          }
        ]
      }).run();
    },
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    searchTerms: ['title', 'big', 'large', 'h1'],
    icon: React.createElement(Heading1, { size: 18 }),
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    searchTerms: ['subtitle', 'medium', 'h2'],
    icon: React.createElement(Heading2, { size: 18 }),
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    searchTerms: ['unordered', 'point', 'ul'],
    icon: React.createElement(List, { size: 18 }),
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Quote',
    description: 'Capture a quote',
    searchTerms: ['blockquote', 'citation'],
    icon: React.createElement(Quote, { size: 18 }),
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Insert a code block',
    searchTerms: ['codeblock', 'pre', 'monospace'],
    icon: React.createElement(Code, { size: 18 }),
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Image',
    description: 'Insert a single image',
    searchTerms: ['photo', 'picture', 'media'],
    icon: React.createElement(Image, { size: 18 }),
    command: ({ editor, range }) => {
      const url = window.prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
      }
    },
  },
]);

export const portfolioSlashCommand = Command.configure({
  suggestion: {
    items: () => portfolioSuggestionItems,
    render: renderItems,
  },
});