export interface BranchInput {
  id: string;
  title: string;
  updatedAt: string;
  parentDiscussionId?: string;
}

export interface BranchNode extends BranchInput {
  children: BranchNode[];
}

export function buildBranchTree(items: BranchInput[]): BranchNode[] {
  const nodes = new Map<string, BranchNode>(
    items.map((item): [string, BranchNode] => [item.id, { ...item, children: [] }])
  );
  const roots: BranchNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.parentDiscussionId
      ? nodes.get(node.parentDiscussionId)
      : undefined;
    if (parent && parent.id !== node.id) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (list: BranchNode[]): BranchNode[] => list
    .slice()
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
    .map((node) => ({ ...node, children: sortNodes(node.children) }));

  return sortNodes(roots);
}
