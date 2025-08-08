import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageCarouselNodeView } from './node-views/image-carousel-node-view';

export interface ImageCarouselOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageCarousel: {
      /**
       * Insert an image carousel
       */
      insertImageCarousel: (options: {
        images: Array<{
          id: string;
          url: string;
          alt?: string;
          caption?: string;
        }>;
        autoPlay?: boolean;
        showThumbnails?: boolean;
      }) => ReturnType;
    };
  }
}

export const ImageCarousel = Node.create<ImageCarouselOptions>({
  name: 'imageCarousel',

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
      images: {
        default: [],
        parseHTML: element => {
          const imagesData = element.getAttribute('data-images');
          return imagesData ? JSON.parse(imagesData) : [];
        },
        renderHTML: attributes => {
          return {
            'data-images': JSON.stringify(attributes.images),
          };
        },
      },
      autoPlay: {
        default: false,
        parseHTML: element => element.getAttribute('data-auto-play') === 'true',
        renderHTML: attributes => {
          return {
            'data-auto-play': attributes.autoPlay,
          };
        },
      },
      showThumbnails: {
        default: true,
        parseHTML: element => element.getAttribute('data-show-thumbnails') === 'true',
        renderHTML: attributes => {
          return {
            'data-show-thumbnails': attributes.showThumbnails,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="image-carousel"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        {
          'data-type': 'image-carousel',
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageCarouselNodeView as any);
  },

  addCommands() {
    return {
      insertImageCarousel:
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