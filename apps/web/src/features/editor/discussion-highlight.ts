import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Discussion } from '@pnode/core';

// Minimal anchor shape the highlighter needs — a subset of Discussion.
interface HighlightSource {
  id: string;
  status: Discussion['status'];
  quote: string;
  prefix: string;
  suffix: string;
}

export const discussionHighlightKey = new PluginKey<PluginState>('discussion-highlight');

interface PluginState {
  sources: HighlightSource[];
  decorations: DecorationSet;
}

// Flatten the document to plain text the same way the selection code does
// (block separator "\n"), while recording the doc position of every character
// so a text match can be mapped back to a ProseMirror range.
function flattenDoc(doc: ProseMirrorNode): { text: string; map: number[] } {
  let text = '';
  const map: number[] = [];
  let firstBlock = true;
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      if (!firstBlock) {
        text += '\n';
        map.push(pos);
      }
      firstBlock = false;
      return true;
    }
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i += 1) {
        text += node.text[i];
        map.push(pos + i);
      }
      return false;
    }
    return true;
  });
  return { text, map };
}

function commonSuffixLength(left: string, right: string): number {
  let count = 0;
  while (count < left.length && count < right.length && left[left.length - 1 - count] === right[right.length - 1 - count]) {
    count += 1;
  }
  return count;
}

function commonPrefixLength(left: string, right: string): number {
  let count = 0;
  while (count < left.length && count < right.length && left[count] === right[count]) {
    count += 1;
  }
  return count;
}

// Find the best occurrence of the quote, disambiguated by how well the text
// around each occurrence matches the stored prefix/suffix. Returns a doc range.
function locate(text: string, map: number[], source: HighlightSource): { from: number; to: number } | undefined {
  const quote = source.quote;
  if (!quote) return undefined;
  const occurrences: number[] = [];
  let index = text.indexOf(quote);
  while (index !== -1) {
    occurrences.push(index);
    index = text.indexOf(quote, index + 1);
  }
  if (occurrences.length === 0) return undefined;

  let best = occurrences[0]!;
  let bestScore = -1;
  for (const occ of occurrences) {
    const before = text.slice(Math.max(0, occ - source.prefix.length), occ);
    const after = text.slice(occ + quote.length, occ + quote.length + source.suffix.length);
    const score = commonSuffixLength(before, source.prefix) + commonPrefixLength(after, source.suffix);
    if (score > bestScore) {
      bestScore = score;
      best = occ;
    }
  }

  const startPos = map[best];
  const endPos = map[best + quote.length - 1];
  if (startPos === undefined || endPos === undefined) return undefined;
  return { from: startPos, to: endPos + 1 };
}

function buildDecorations(doc: ProseMirrorNode, sources: HighlightSource[]): DecorationSet {
  if (sources.length === 0) return DecorationSet.empty;
  const { text, map } = flattenDoc(doc);
  const decorations: Decoration[] = [];
  for (const source of sources) {
    const range = locate(text, map, source);
    if (!range) continue;
    decorations.push(Decoration.inline(
      range.from,
      range.to,
      { class: 'discussion-highlight', 'data-status': source.status, 'data-discussion-id': source.id },
      { discussionId: source.id }
    ));
  }
  return DecorationSet.create(doc, decorations);
}

function toSources(discussions: Discussion[]): HighlightSource[] {
  return discussions.map((discussion) => ({
    id: discussion.id,
    status: discussion.status,
    quote: discussion.anchor.quote,
    prefix: discussion.anchor.prefix,
    suffix: discussion.anchor.suffix
  }));
}

// Push the current anchors into the plugin. Called on load and whenever the
// discussion set changes; the doc-change path keeps highlights aligned as the
// user edits. Clicks are handled in React via `data-discussion-id` delegation,
// so no handler needs to live inside the plugin.
export function setDiscussionHighlights(
  editor: { view: { state: unknown; dispatch(tr: unknown): void } },
  discussions: Discussion[]
): void {
  const view = editor.view as { state: { tr: { setMeta(key: unknown, value: unknown): unknown } }; dispatch(tr: unknown): void };
  view.dispatch(view.state.tr.setMeta(discussionHighlightKey, toSources(discussions)));
}

export const DiscussionHighlight = Extension.create({
  name: 'discussionHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<PluginState>({
        key: discussionHighlightKey,
        state: {
          init: () => ({ sources: [], decorations: DecorationSet.empty }),
          apply(tr, previous, _oldState, newState) {
            const meta = tr.getMeta(discussionHighlightKey) as HighlightSource[] | undefined;
            if (meta) {
              return { sources: meta, decorations: buildDecorations(newState.doc, meta) };
            }
            if (tr.docChanged) {
              return { ...previous, decorations: buildDecorations(newState.doc, previous.sources) };
            }
            return previous;
          }
        },
        props: {
          decorations(state) {
            return discussionHighlightKey.getState(state)?.decorations ?? DecorationSet.empty;
          }
        }
      })
    ];
  }
});
