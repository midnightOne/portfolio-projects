import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { InteractiveEmbedNodeView } from './node-views/interactive-embed-node-view';

export interface InteractiveEmbedOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    interactiveEmbed: {
      /**
       * Insert an interactive embed
       */
      insertInteractiveEmbed: (options: {
        url: string;
        title?: string;
        description?: string;
        type: 'iframe' | 'webxr' | 'canvas';
        width?: number;
        height?: number;
        allowFullscreen?: boolean;
        sandbox?: string;
      }) => ReturnType;
    };
  }
}

export const InteractiveEmbed = Node.create<InteractiveEmbedOptions>({
  name: 'interactiveEmbed',

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
      url: {
        default: '',
        parseHTML: element => element.getAttribute('data-url'),
        renderHTML: attributes => {
          return {
            'data-url': attributes.url,
          };
        },
      },
      title: {
        default: '',
        parseHTML: element => element.getAttribute('data-title'),
        renderHTML: attributes => {
          return {
            'data-title': attributes.title,
          };
        },
      },
      description: {
        default: '',
        parseHTML: element => element.getAttribute('data-description'),
        renderHTML: attributes => {
          return {
            'data-description': attributes.description,
          };
        },
      },
      type: {
        default: 'iframe',
        parseHTML: element => element.getAttribute('data-type') || 'iframe',
        renderHTML: attributes => {
          return {
            'data-type': attributes.type,
          };
        },
      },
      width: {
        default: 800,
        parseHTML: element => {
          const width = element.getAttribute('data-width');
          return width ? parseInt(width, 10) : 800;
        },
        renderHTML: attributes => {
          return {
            'data-width': attributes.width,
          };
        },
      },
      height: {
        default: 600,
        parseHTML: element => {
          const height = element.getAttribute('data-height');
          return height ? parseInt(height, 10) : 600;
        },
        renderHTML: attributes => {
          return {
            'data-height': attributes.height,
          };
        },
      },
      allowFullscreen: {
        default: true,
        parseHTML: element => element.getAttribute('data-allow-fullscreen') === 'true',
        renderHTML: attributes => {
          return {
            'data-allow-fullscreen': attributes.allowFullscreen,
          };
        },
      },
      sandbox: {
        default: 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation',
        parseHTML: element => element.getAttribute('data-sandbox'),
        renderHTML: attributes => {
          return {
            'data-sandbox': attributes.sandbox,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="interactive-embed"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        {
          'data-type': 'interactive-embed',
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InteractiveEmbedNodeView as any);
  },

  addCommands() {
    return {
      insertInteractiveEmbed:
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