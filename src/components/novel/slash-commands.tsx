import { 
  Image, 
  Images, 
  Download, 
  Folder, 
  Monitor,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Table
} from 'lucide-react';

export interface SlashCommand {
  title: string;
  description: string;
  searchTerms: string[];
  icon: React.ComponentType<{ className?: string }>;
  command: ({ editor, range }: { editor: any; range: any }) => void;
}

export const portfolioSlashCommands: SlashCommand[] = [
  // Portfolio-specific commands
  {
    title: 'Image Carousel',
    description: 'Insert a carousel with multiple images',
    searchTerms: ['carousel', 'images', 'gallery', 'slideshow'],
    icon: Images,
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
    title: 'Interactive Embed',
    description: 'Embed interactive content (iframe, WebXR, canvas)',
    searchTerms: ['interactive', 'embed', 'iframe', 'webxr', 'canvas', 'demo'],
    icon: Monitor,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertInteractiveEmbed({
        url: 'https://example.com/demo',
        type: 'iframe',
        title: 'Interactive Demo',
        width: '100%',
        height: '400px'
      }).run();
    },
  },
  {
    title: 'Download Button',
    description: 'Add a download button for files',
    searchTerms: ['download', 'file', 'attachment', 'button'],
    icon: Download,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertDownloadButton({
        files: [
          {
            url: '#',
            filename: 'sample-file.zip',
            size: '2.5 MB',
            type: 'application/zip'
          }
        ],
        label: 'Download',
        variant: 'single'
      }).run();
    },
  },
  {
    title: 'Project Reference',
    description: 'Link to another project',
    searchTerms: ['project', 'reference', 'link', 'internal'],
    icon: Folder,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertProjectReference({
        projectId: 'sample-project-id',
        projectTitle: 'Sample Project',
        displayText: 'Check out this project'
      }).run();
    },
  },
  
  // Standard formatting commands
  {
    title: 'Heading 1',
    description: 'Large section heading',
    searchTerms: ['title', 'big', 'large', 'h1'],
    icon: Heading1,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    searchTerms: ['subtitle', 'medium', 'h2'],
    icon: Heading2,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    searchTerms: ['subtitle', 'small', 'h3'],
    icon: Heading3,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    searchTerms: ['unordered', 'point', 'ul'],
    icon: List,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Create a numbered list',
    searchTerms: ['ordered', 'numbered', 'ol'],
    icon: ListOrdered,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Quote',
    description: 'Capture a quote',
    searchTerms: ['blockquote', 'citation'],
    icon: Quote,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Insert a code block',
    searchTerms: ['codeblock', 'pre', 'monospace'],
    icon: Code,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Image',
    description: 'Insert a single image',
    searchTerms: ['photo', 'picture', 'media'],
    icon: Image,
    command: ({ editor, range }) => {
      const url = window.prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
      }
    },
  },
  {
    title: 'Table',
    description: 'Insert a table',
    searchTerms: ['table', 'grid', 'rows', 'columns'],
    icon: Table,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
];