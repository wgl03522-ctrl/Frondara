import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditorExtensions } from '../src/features/editor/markdown.js';

let editor: Editor | undefined;

afterEach(() => editor?.destroy());

describe('Markdown editor extensions', () => {
  it('round-trips headings, formulas, and footnotes', () => {
    const markdown = [
      '# 研究标题',
      '',
      '正文包含 $E = mc^2$ 与来源[^1]。',
      '',
      '$$',
      '\\sum_{i=1}^{n} x_i',
      '$$',
      '',
      '[^1]: 来源说明'
    ].join('\n');

    editor = new Editor({
      extensions: createEditorExtensions(),
      content: markdown,
      contentType: 'markdown'
    });

    const serialized = editor.getMarkdown();
    expect(serialized).toContain('# 研究标题');
    expect(serialized).toContain('$E = mc^2$');
    expect(serialized).toContain('$$\n\\sum_{i=1}^{n} x_i\n$$');
    expect(serialized).toContain('[^1]');
    expect(serialized).toContain('[^1]: 来源说明');
  });
});
