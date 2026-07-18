import { Node, type JSONContent, type MarkdownToken } from '@tiptap/core';
import { Mathematics } from '@tiptap/extension-mathematics';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { DiscussionHighlight } from './discussion-highlight.js';

const FootnoteReference = Node.create({
  name: 'footnoteReference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return { id: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'sup[data-type="footnote-reference"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'sup',
      { ...HTMLAttributes, 'data-type': 'footnote-reference' },
      `[^${String(HTMLAttributes.id ?? '')}]`
    ];
  },
  parseMarkdown: (token: MarkdownToken) => {
    const footnote = token as MarkdownToken & { id?: string };
    return {
      type: 'footnoteReference',
      attrs: { id: footnote.id ?? '' }
    };
  },
  renderMarkdown: (node: JSONContent) => `[^${String(node.attrs?.id ?? '')}]`,
  markdownTokenizer: {
    name: 'footnoteReference',
    level: 'inline' as const,
    start: (source: string) => source.indexOf('[^'),
    tokenize: (source: string) => {
      const match = source.match(/^\[\^([^\]]+)\]/);
      if (!match) return undefined;
      return { type: 'footnoteReference', raw: match[0], id: match[1] };
    }
  }
});

const FootnoteDefinition = Node.create({
  name: 'footnoteDefinition',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      id: { default: '' },
      content: { default: '' }
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="footnote-definition"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      { ...HTMLAttributes, 'data-type': 'footnote-definition' },
      `[^${String(HTMLAttributes.id ?? '')}]: ${String(HTMLAttributes.content ?? '')}`
    ];
  },
  parseMarkdown: (token: MarkdownToken) => {
    const footnote = token as MarkdownToken & { id?: string; content?: string };
    return {
      type: 'footnoteDefinition',
      attrs: { id: footnote.id ?? '', content: footnote.content ?? '' }
    };
  },
  renderMarkdown: (node: JSONContent) =>
    `[^${String(node.attrs?.id ?? '')}]: ${String(node.attrs?.content ?? '')}`,
  markdownTokenizer: {
    name: 'footnoteDefinition',
    level: 'block' as const,
    start: (source: string) => source.search(/^\[\^[^\]]+\]:/m),
    tokenize: (source: string) => {
      const match = source.match(/^\[\^([^\]]+)\]:[ \t]*(.*)(?:\n|$)/);
      if (!match) return undefined;
      return { type: 'footnoteDefinition', raw: match[0], id: match[1], content: match[2] };
    }
  }
});

export function createEditorExtensions(placeholder = '开始写下你的研究问题…') {
  return [
    StarterKit.configure({
      link: { openOnClick: false },
      codeBlock: { enableTabIndentation: true }
    }),
    TableKit.configure({ table: { resizable: true } }),
    Placeholder.configure({ placeholder }),
    Markdown,
    Mathematics.configure({ katexOptions: { throwOnError: false } }),
    FootnoteReference,
    FootnoteDefinition,
    DiscussionHighlight
  ];
}

export { FootnoteDefinition, FootnoteReference };
