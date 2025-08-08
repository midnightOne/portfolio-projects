import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { DownloadButtonNodeView } from './node-views/download-button-node-view';

export interface DownloadButtonOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    downloadButton: {
      /**
       * Insert a download button
       */
      insertDownloadButton: (options: {
        files: Array<{
          id: string;
          name: string;
          url: string;
          size?: number;
          type?: string;
          description?: string;
        }>;
        label?: string;
        variant?: 'single' | 'dropdown';
        style?: 'primary' | 'secondary' | 'outline';
      }) => ReturnType;
    };
  }
}

export const DownloadButton = Node.create<DownloadButtonOptions>({
  name: 'downloadButton',

  group: 'block',

  content: '',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      files: {
        default: [],
        parseHTML: element => {
          const filesData = element.getAttribute('data-files');
          return filesData ? JSON.parse(filesData) : [];
        },
        renderHTML: attributes => {
          return {
            'data-files': JSON.stringify(attributes.files),
          };
        },
      },
      label: {
        default: 'Download',
        parseHTML: element => element.getAttribute('data-label') || 'Download',
        renderHTML: attributes => {
          return {
            'data-label': attributes.label,
          };
        },
      },
      variant: {
        default: 'single',
        parseHTML: element => element.getAttribute('data-variant') || 'single',
        renderHTML: attributes => {
          return {
            'data-variant': attributes.variant,
          };
        },
      },
      style: {
        default: 'primary',
        parseHTML: element => element.getAttribute('data-style') || 'primary',
        renderHTML: attributes => {
          return {
            'data-style': attributes.style,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="download-button"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        {
          'data-type': 'download-button',
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DownloadButtonNodeView as any);
  },

  addCommands() {
    return {
      insertDownloadButton:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});