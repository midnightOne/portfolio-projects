import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion, SuggestionOptions } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { SlashCommandsList } from './slash-commands-list';

export interface SlashCommand {
  title: string;
  description: string;
  searchTerms: string[];
  icon: React.ComponentType<{ className?: string }>;
  command: ({ editor, range }: { editor: any; range: any }) => void;
}

export interface SlashCommandsOptions {
  suggestion: Omit<SuggestionOptions, 'editor'>;
}

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        pluginKey: new PluginKey('slashCommands'),
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const type = state.schema.nodes.paragraph;
          const isParagraph = $from.parent.type === type;
          const isStartOfNode = $from.parentOffset === 0;

          // More permissive: allow slash commands at the start of any paragraph
          return isParagraph && isStartOfNode;
        },
        items: ({ query }) => {
          // This will be overridden by the configure() call
          return [];
        },
        render: () => {
          let component: ReactRenderer;
          let popup: TippyInstance[];

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandsList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) {
                return;
              }

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                theme: 'slash-commands',
                maxWidth: 'none',
                offset: [0, 8],
                popperOptions: {
                  modifiers: [
                    {
                      name: 'flip',
                      options: {
                        fallbackPlacements: ['top-start', 'bottom-start'],
                      },
                    },
                  ],
                },
              });
            },

            onUpdate(props) {
              component.updateProps(props);

              if (!props.clientRect) {
                return;
              }

              popup[0].setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },

            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup[0].hide();
                return true;
              }

              return (component.ref as any)?.onKeyDown?.(props) || false;
            },

            onExit() {
              popup[0].destroy();
              component.destroy();
            },
          };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});