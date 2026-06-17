import { formatOption, pathwayKey } from "./pathway-scheme.js";
import type { IvrNode, IvrTree } from "./tree-types.js";
import { getRootNode } from "./tree-types.js";

/** Short status marker shown after a leaf option. */
function nodeMarker(node: IvrNode | undefined): string {
  if (!node) {
    return " (unexplored)";
  }
  if (node.loopGuard) {
    return " (looping option — not explored)";
  }
  if (node.unknownOption) {
    return " (unknown option — not explored)";
  }
  if (node.sameAsParent) {
    return " (same as parent — not explored)";
  }
  if (node.speakingOption) {
    return " (spoken option — not explored)";
  }
  if (node.loopTo) {
    return ` (↩ loops to /${node.loopTo.join("/") || "root"})`;
  }
  if (node.failed) {
    return " (failed)";
  }
  if (node.explored && node.edges.length === 0) {
    return ` (terminal)${nodeConfidence(node)}`;
  }
  if (!node.explored) {
    return " (unexplored)";
  }
  return nodeConfidence(node);
}

/** ` [conf 0.86]` for an explored node, else "". */
function nodeConfidence(node: IvrNode): string {
  if (node.confidence === undefined) {
    return "";
  }
  return ` [conf ${node.confidence.toFixed(2)}]`;
}

/** ` (p=0.67)` for how reliably this option appeared in its parent's menu. */
function optionConfidence(parent: IvrNode, key: string): string {
  const match = parent.optionConfidences?.find((opt) => opt.key === key);
  if (!match) {
    return "";
  }
  return ` (p=${match.confidence.toFixed(2)})`;
}

function renderMenuOptions(
  node: IvrNode,
  tree: IvrTree,
  prefix: string,
  lines: string[],
): void {
  for (const [index, edge] of node.edges.entries()) {
    const isLast = index === node.edges.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = prefix + (isLast ? "    " : "│   ");

    const target = tree.nodes.get(pathwayKey(edge.targetPathway));
    lines.push(
      `${prefix}${connector}${formatOption(edge.key, edge.label)}${optionConfidence(node, edge.key)}${nodeMarker(target)}`,
    );

    // Only recurse into a real child menu (avoid loop-back nodes).
    if (target && target.edges.length > 0 && !target.loopTo) {
      renderMenuOptions(target, tree, childPrefix, lines);
    }
  }
}

/** Renders the IVR tree to a plain-text string (no side effects). */
export function renderIvrTree(tree: IvrTree): string {
  const root = getRootNode(tree);
  const lines: string[] = [];

  lines.push("--- IVR Tree ---");
  lines.push(`${tree.phoneNumber} — ${root.title}${nodeConfidence(root)}`);

  if (root.edges.length === 0) {
    lines.push("  (no menu options discovered yet)");
    return lines.join("\n");
  }

  renderMenuOptions(root, tree, "", lines);
  return lines.join("\n");
}

/** Prints the IVR tree to the console. */
export function printIvrTree(tree: IvrTree): void {
  console.log(`\n${renderIvrTree(tree)}`);
}
