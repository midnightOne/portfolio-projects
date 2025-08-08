import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ProjectReferenceNodeView } from './node-views/project-reference-node-view';

export interface ProjectReferenceOptions {
  HTMLAttributes: Record<string, any>;
  validateProject?: (projectId: string) => Promise<boolean>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    projectReference: {
      /**
       * Insert a project reference
       */
      insertProjectReference: (options: {
        projectId: string;
        projectSlug?: string;
        title?: string;
        description?: string;
        thumbnailUrl?: string;
        style?: 'card' | 'inline' | 'minimal';
      }) => ReturnType;
    };
  }
}

export const ProjectReference = Node.create<ProjectReferenceOptions>({
  name: 'projectReference',

  group: 'block',

  content: '',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      validateProject: undefined,
    };
  },

  addAttributes() {
    return {
      projectId: {
        default: '',
        parseHTML: element => element.getAttribute('data-project-id'),
        renderHTML: attributes => {
          return {
            'data-project-id': attributes.projectId,
          };
        },
      },
      projectSlug: {
        default: '',
        parseHTML: element => element.getAttribute('data-project-slug'),
        renderHTML: attributes => {
          return {
            'data-project-slug': attributes.projectSlug,
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
      thumbnailUrl: {
        default: '',
        parseHTML: element => element.getAttribute('data-thumbnail-url'),
        renderHTML: attributes => {
          return {
            'data-thumbnail-url': attributes.thumbnailUrl,
          };
        },
      },
      style: {
        default: 'card',
        parseHTML: element => element.getAttribute('data-style') || 'card',
        renderHTML: attributes => {
          return {
            'data-style': attributes.style,
          };
        },
      },
      isValid: {
        default: true,
        parseHTML: element => element.getAttribute('data-is-valid') !== 'false',
        renderHTML: attributes => {
          return {
            'data-is-valid': attributes.isValid,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="project-reference"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        {
          'data-type': 'project-reference',
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ProjectReferenceNodeView as any);
  },

  addCommands() {
    return {
      insertProjectReference:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  // Simple validation on creation - more complex validation can be handled by the node view
  onCreate() {
    // Basic setup - validation will be handled by the node view component
  },
});