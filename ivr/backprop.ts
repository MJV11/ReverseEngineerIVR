import { parentPathway } from "./pathway-scheme.js";
import { getNode, type IvrEdge, type IvrTree, type Pathway } from "./tree-types.js";

/** Sibling options at this node's parent menu (excluding the edge we arrived on). */
export function brotherOptions(tree: IvrTree, pathway: Pathway): IvrEdge[] {
  const parent = parentPathway(pathway);
  if (parent === null) {
    return [];
  }
  const parentNode = getNode(tree, parent);
  if (!parentNode) {
    return [];
  }
  const incomingKey = pathway[pathway.length - 1];
  return parentNode.edges.filter((edge) => edge.key !== incomingKey);
}

/**
 * True when `edge` matches a sibling option at the parent menu — same key or
 * same label (case-insensitive). These back-navigate to an uncle branch.
 */
export function isBackpropEdge(
  tree: IvrTree,
  pathway: Pathway,
  edge: IvrEdge,
): boolean {
  const normalizedLabel = edge.label.trim().toLowerCase();
  return brotherOptions(tree, pathway).some(
    (brother) =>
      brother.key === edge.key ||
      brother.label.trim().toLowerCase() === normalizedLabel,
  );
}

/** Mark edge + target node as backprop; returns true if marked. */
export function markBackpropEdge(
  tree: IvrTree,
  pathway: Pathway,
  edge: IvrEdge,
): boolean {
  if (!isBackpropEdge(tree, pathway, edge)) {
    return false;
  }
  edge.isBackprop = true;
  const child = getNode(tree, edge.targetPathway);
  if (child) {
    child.backpropEdge = true;
  }
  return true;
}
