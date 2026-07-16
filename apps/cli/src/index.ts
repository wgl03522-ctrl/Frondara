#!/usr/bin/env node
import { Command } from 'commander';
import {
  docsList,
  docsShow,
  discussionsList,
  discussionsShow,
  discussionsTree,
  discussionsFork,
  versionsList,
  versionsRestore
} from './commands.js';

// pnode CLI: a hidden advanced surface over the local workspace. It talks to the
// storage layer directly (no server, no AI), covering read operations plus the
// non-AI writes: forking a discussion direction and restoring a document version.

function workspaceRoot(command: Command): string {
  const root = command.optsWithGlobals().workspace as string | undefined;
  return root ?? process.cwd();
}

async function emit(action: () => Promise<string>): Promise<void> {
  try {
    process.stdout.write(`${await action()}\n`);
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

const program = new Command();
program
  .name('pnode')
  .description('pnode 本地工作区命令行（只读与非 AI 写操作）')
  .option('-w, --workspace <dir>', '工作区目录，默认当前目录');

const docs = program.command('docs').description('文档');
docs.command('list').description('列出 Markdown 文档')
  .action((_options, command: Command) => emit(() => docsList(workspaceRoot(command))));
docs.command('show <path>').description('打印文档内容')
  .action((path: string, _options, command: Command) => emit(() => docsShow(workspaceRoot(command), path)));

const discussions = program.command('discussions').description('段落讨论');
discussions.command('list').description('列出讨论')
  .option('-d, --document <path>', '仅显示某文档的讨论')
  .action((options: { document?: string }, command: Command) =>
    emit(() => discussionsList(workspaceRoot(command), options.document)));
discussions.command('show <id>').description('显示单条讨论及其消息')
  .action((id: string, _options, command: Command) => emit(() => discussionsShow(workspaceRoot(command), id)));
discussions.command('tree').description('以缩进树展示讨论关系（讨论方向）')
  .option('-d, --document <path>', '仅显示某文档的讨论')
  .action((options: { document?: string }, command: Command) =>
    emit(() => discussionsTree(workspaceRoot(command), options.document)));
discussions.command('fork <id> <messageId> <title>').description('从某条消息另行讨论（不调用 AI）')
  .action((id: string, messageId: string, title: string, _options, command: Command) =>
    emit(() => discussionsFork(workspaceRoot(command), id, messageId, title)));

const versions = program.command('versions').description('文档版本');
versions.command('list <path>').description('列出某文档的版本（最新在前）')
  .action((path: string, _options, command: Command) => emit(() => versionsList(workspaceRoot(command), path)));
versions.command('restore <path> <versionId>').description('恢复文档到指定版本（会先快照当前内容）')
  .action((path: string, versionId: string, _options, command: Command) =>
    emit(() => versionsRestore(workspaceRoot(command), path, versionId)));

await program.parseAsync(process.argv);
