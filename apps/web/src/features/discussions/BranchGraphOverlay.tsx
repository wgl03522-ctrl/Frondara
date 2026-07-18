import { useMemo } from 'react';
import { buildBranchTree, type BranchNode, type Discussion } from '@pnode/core';
import { CloseIcon } from '../../components/icons.js';
import { useI18n } from '../../i18n/I18nProvider.js';

interface BranchGraphOverlayProps {
  discussions: Discussion[];
  currentId?: string | undefined;
  onOpenBranch(discussion: Discussion): void;
  onClose(): void;
}

interface PlacedNode {
  node: BranchNode;
  depth: number;
  row: number;
}

function placeNodes(roots: BranchNode[]): { placed: PlacedNode[]; rows: number } {
  const placed: PlacedNode[] = [];
  let row = 0;
  const walk = (node: BranchNode, depth: number) => {
    placed.push({ node, depth, row });
    if (node.children.length === 0) {
      row += 1;
      return;
    }
    for (const child of node.children) walk(child, depth + 1);
  };
  for (const root of roots) walk(root, 0);
  return { placed, rows: Math.max(row, 1) };
}

const COL_WIDTH = 220;
const ROW_HEIGHT = 84;
const NODE_WIDTH = 176;
const NODE_HEIGHT = 52;
const PADDING = 48;

export function BranchGraphOverlay({ discussions, currentId, onOpenBranch, onClose }: BranchGraphOverlayProps) {
  const { t } = useI18n();
  const { placed, rows, positions } = useMemo(() => {
    const roots = buildBranchTree(discussions.map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: item.updatedAt,
      ...(item.parentDiscussionId ? { parentDiscussionId: item.parentDiscussionId } : {})
    })));
    const layout = placeNodes(roots);
    const positionMap = new Map<string, { x: number; y: number }>();
    for (const item of layout.placed) {
      positionMap.set(item.node.id, { x: PADDING + item.depth * COL_WIDTH, y: PADDING + item.row * ROW_HEIGHT });
    }
    return { ...layout, positions: positionMap };
  }, [discussions]);
  const byId = useMemo(() => new Map(discussions.map((item) => [item.id, item])), [discussions]);
  const maxDepth = placed.reduce((max, item) => Math.max(max, item.depth), 0);
  const width = PADDING * 2 + maxDepth * COL_WIDTH + NODE_WIDTH;
  const height = PADDING * 2 + rows * ROW_HEIGHT;

  return (
    <div className="graph-overlay" role="dialog" aria-modal="true" aria-label={t('graph.aria')}>
      <header className="graph-overlay-header">
        <div>
          <span className="eyebrow">{t('graph.aria')}</span>
          <h2>{t('graph.title')}</h2>
        </div>
        <button type="button" className="icon-button" aria-label={t('graph.close')} onClick={onClose}><CloseIcon /></button>
      </header>
      <div className="graph-canvas" role="tree" aria-label={t('graph.aria')}>
        <svg className="graph-edges" width={width} height={height} aria-hidden="true">
          {placed.map((item) => item.node.children.map((child) => {
            const from = positions.get(item.node.id)!;
            const to = positions.get(child.id)!;
            const x1 = from.x + NODE_WIDTH;
            const y1 = from.y + NODE_HEIGHT / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_HEIGHT / 2;
            const mid = (x1 + x2) / 2;
            return <path key={`${item.node.id}-${child.id}`} className="graph-edge" d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} />;
          }))}
        </svg>
        <div className="graph-nodes" style={{ width, height }}>
          {placed.map((item) => {
            const pos = positions.get(item.node.id)!;
            const isCurrent = item.node.id === currentId;
            const target = byId.get(item.node.id);
            return (
              <button
                key={item.node.id}
                type="button"
                role="treeitem"
                className="graph-node"
                data-current={isCurrent}
                style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                disabled={isCurrent || !target}
                onClick={() => target && onOpenBranch(target)}
                title={item.node.title}
              >
                <span className="graph-node-title">{item.node.title}</span>
                {isCurrent && <span className="graph-node-badge">{t('common.current')}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
