import {
  DiscussionStore,
  DocumentStore,
  VersionStore
} from '@pnode/storage';
import { buildBranchTree, type BranchNode, type Discussion } from '@pnode/core';

// Each command is a pure async function that takes the workspace root plus its
// arguments and returns the text to print. Keeping them free of process/exit and
// console lets the tests assert on the output directly.

export async function docsList(root: string): Promise<string> {
  const entries = await new DocumentStore(root).list();
  const files = entries.filter((entry) => entry.type === 'file');
  if (files.length === 0) return '(工作区内没有 Markdown 文档)';
  return files.map((entry) => entry.path).join('\n');
}

export async function docsShow(root: string, path: string): Promise<string> {
  const document = await new DocumentStore(root).read(path);
  return document.content;
}

export async function discussionsList(root: string, documentPath?: string): Promise<string> {
  const discussions = await new DiscussionStore(root).list(documentPath);
  if (discussions.length === 0) return '(没有讨论)';
  return discussions
    .map((discussion) => `${discussion.id}  [${discussion.status}]  ${discussion.title}`)
    .join('\n');
}

export async function discussionsShow(root: string, id: string): Promise<string> {
  const discussion = await new DiscussionStore(root).get(id);
  const header = [
    `${discussion.id}  [${discussion.status}]  ${discussion.title}`,
    `原文：“${discussion.anchor.quote}”`,
    discussion.parentDiscussionId
      ? `讨论方向，源自 ${discussion.parentDiscussionId}（消息 ${discussion.forkedFromMessageId}）`
      : undefined
  ].filter((line): line is string => line !== undefined);
  const messages = discussion.messages.map((message) => {
    const who = message.role === 'user' ? '你' : 'AI';
    return `  ${who}｜${message.content}`;
  });
  return [...header, messages.length > 0 ? '消息：' : '(暂无消息)', ...messages].join('\n');
}

export async function discussionsTree(root: string, documentPath?: string): Promise<string> {
  const discussions = await new DiscussionStore(root).list(documentPath);
  if (discussions.length === 0) return '(没有讨论)';
  const tree = buildBranchTree(discussions.map(toBranchInput));
  const lines: string[] = [];
  const walk = (nodes: BranchNode[], depth: number): void => {
    for (const node of nodes) {
      lines.push(`${'  '.repeat(depth)}${depth > 0 ? '└─ ' : ''}${node.title}  (${node.id})`);
      walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);
  return lines.join('\n');
}

export async function discussionsFork(
  root: string,
  sourceId: string,
  messageId: string,
  title: string
): Promise<string> {
  const fork = await new DiscussionStore(root).forkFromMessage(sourceId, messageId, title);
  return `已创建讨论方向：${fork.id}  ${fork.title}`;
}

export async function versionsList(root: string, documentPath: string): Promise<string> {
  const versions = await new VersionStore(root, new DocumentStore(root)).list(documentPath);
  if (versions.length === 0) return '(没有版本)';
  return versions
    .map((version) => `${version.id}  [${version.reason}]  ${version.createdAt}`)
    .join('\n');
}

export async function versionsRestore(
  root: string,
  documentPath: string,
  versionId: string
): Promise<string> {
  const documents = new DocumentStore(root);
  const result = await new VersionStore(root, documents).restore(documentPath, versionId);
  return [
    `已恢复 ${documentPath} 到版本 ${versionId}`,
    `恢复前已快照当前内容：${result.recoveryVersion.id}`
  ].join('\n');
}

function toBranchInput(discussion: Discussion) {
  return {
    id: discussion.id,
    title: discussion.title,
    updatedAt: discussion.updatedAt,
    ...(discussion.parentDiscussionId ? { parentDiscussionId: discussion.parentDiscussionId } : {})
  };
}
