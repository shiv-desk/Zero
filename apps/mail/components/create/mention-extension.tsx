import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import type { Instance } from 'tippy.js'
import { Mention } from '@tiptap/extension-mention'
import { MentionList } from './mention-list'
import type { MentionListRef } from './mention-list'

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon?: string;
  logo?: string;
  execute: () => void | Promise<void>;
}

interface ToolMentionOptions {
  tools: Tool[];
  onToolMention?: (tool: Tool) => void;
}

export const createToolMention = (options: ToolMentionOptions) => {
  const { tools, onToolMention } = options;

  return Mention.configure({
    HTMLAttributes: {
      class: 'bg-blue-100 text-blue-800 px-1 py-0.5 rounded-md font-medium hover:bg-blue-200 transition-colors cursor-pointer dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800',
      'data-tool-id': (node: any) => node.attrs.id,
    },
    renderLabel({ options, node }) {
      return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`;
    },
    suggestion: {
      char: '@',
      items: ({ query }) => {
        return tools
          .filter(tool => 
            tool.name.toLowerCase().includes(query.toLowerCase()) ||
            tool.description?.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 5);
      },
      render: () => {
        let component: ReactRenderer<MentionListRef>;
        let popup: Instance[];

        return {
          onStart: (props) => {
            component = new ReactRenderer(MentionList, {
              props: {
                ...props,
                command: (item: { id: string; name: string }) => {
                  const selectedTool = tools.find(tool => tool.id === item.id);
                  if (selectedTool && onToolMention) {
                    onToolMention(selectedTool);
                  }
                  props.command(item);
                },
              },
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
              animation: 'shift-away',
              maxWidth: 'none',
              zIndex: 9999,
              theme: 'light',
            });
          },

          onUpdate(props) {
            component.updateProps({
              ...props,
              command: (item: { id: string; name: string }) => {
                const selectedTool = tools.find(tool => tool.id === item.id);
                if (selectedTool && onToolMention) {
                  onToolMention(selectedTool);
                }
                props.command(item);
              },
            });

            if (!props.clientRect) {
              return;
            }

            popup?.[0]?.setProps({
              getReferenceClientRect: props.clientRect as () => DOMRect,
            });
          },

          onKeyDown(props) {
            if (props.event.key === 'Escape') {
              popup?.[0]?.hide();
              return true;
            }

            return component.ref?.onKeyDown(props) ?? false;
          },

          onExit() {
            popup?.[0]?.destroy();
            component.destroy();
          },
        };
      },
    },
  });
}; 