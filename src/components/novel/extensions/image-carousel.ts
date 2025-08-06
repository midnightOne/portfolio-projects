import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageCarouselNodeView } from '../node-views/image-carousel-node-view';

export interface ImageCarouselOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageCarousel: {
      insertImageCarousel: (options: { 
        images: Array<{ src: string; alt?: string; caption?: string }> 
      }) => ReturnType;
    };
  }
}

export const ImageCarousel = Node.create<ImageCarouselOptions>({
  name: 'imageCarousel',
  group: 'block',
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
        renderHTML: attributes => ({
          'data-images': JSON.stringify(attributes.images),
        }),
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
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'image-carousel' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageCarouselNodeView);
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