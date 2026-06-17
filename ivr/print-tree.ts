import {
  formatNodeName,
  formatOption,
  pathwayKey,
} from "./pathway-scheme.js";
import type { IvrEdge, IvrNode, IvrNodeCall, IvrTree, Pathway } from "./tree-types.js";
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
  if (node.backpropEdge) {
    return " (backprop edge — not explored)";
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

function formatPathway(pathway: Pathway): string {
  return pathway.length === 0 ? "/root" : `/${pathway.join("/")}`;
}

function edgeFlagsSuffix(edge: IvrEdge): string {
  const flags: string[] = [];
  if (edge.isBackprop) {
    flags.push("isBackprop");
  }
  if (edge.isReverse) {
    flags.push("isReverse");
  }
  return flags.length > 0 ? ` {${flags.join(", ")}}` : "";
}

function nodeStateFlags(node: IvrNode): string[] {
  const flags: string[] = [];
  if (node.explored) {
    flags.push("explored");
  }
  if (node.failed) {
    flags.push("failed");
  }
  if (node.isTerminal) {
    flags.push("terminal");
  }
  if (node.loopGuard) {
    flags.push("loopGuard");
  }
  if (node.unknownOption) {
    flags.push("unknownOption");
  }
  if (node.sameAsParent) {
    flags.push("sameAsParent");
  }
  if (node.backpropEdge) {
    flags.push("backpropEdge");
  }
  if (node.speakingOption) {
    flags.push("speakingOption");
  }
  if (node.loopTo) {
    flags.push(`loopTo=${formatPathway(node.loopTo)}`);
  }
  return flags;
}

function renderCallRecord(call: IvrNodeCall, indent: string, lines: string[]): void {
  const parts = [call.callId];
  if (call.durationSec !== undefined) {
    parts.push(`${call.durationSec}s`);
  }
  if (call.status) {
    parts.push(call.status);
  }
  if (call.answeredBy) {
    parts.push(`answered_by=${call.answeredBy}`);
  }
  if (call.timestamp) {
    parts.push(call.timestamp);
  }
  lines.push(`${indent}  · ${parts.join(" · ")}`);

  if (call.recordingUrl) {
    lines.push(`${indent}    recording: ${call.recordingUrl}`);
  }

  const transcript = call.transcript?.trim();
  if (transcript) {
    lines.push(`${indent}    transcript:`);
    for (const line of transcript.split("\n")) {
      lines.push(`${indent}      ${line}`);
    }
  }
}

/** Indented metadata block for a node's stored fields (calls, flags, options, etc.). */
function renderNodeMetadata(node: IvrNode, indent: string, lines: string[]): void {
  const summary: string[] = [
    formatPathway(node.pathway),
    formatNodeName(node.pathwayNumber, node.title),
    ...nodeStateFlags(node),
  ];
  if (node.attempts !== undefined) {
    summary.push(`attempts=${node.attempts}`);
  }
  if (node.confidence !== undefined) {
    summary.push(`conf=${node.confidence.toFixed(2)}`);
  }
  if (node.sourceCallId) {
    summary.push(`sourceCallId=${node.sourceCallId}`);
  }
  lines.push(`${indent}${summary.join(" · ")}`);

  if (node.optionConfidences && node.optionConfidences.length > 0) {
    const options = node.optionConfidences
      .map(
        (option) =>
          `${formatOption(option.key, option.label)} (p=${option.confidence.toFixed(2)})`,
      )
      .join(", ");
    lines.push(`${indent}options: ${options}`);
  }

  if (node.calls.length > 0) {
    lines.push(`${indent}calls:`);
    for (const call of node.calls) {
      renderCallRecord(call, indent, lines);
    }
  }
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
      `${prefix}${connector}${formatOption(edge.key, edge.label)}${optionConfidence(node, edge.key)}${edgeFlagsSuffix(edge)}${nodeMarker(target)}`,
    );

    if (target) {
      renderNodeMetadata(target, childPrefix, lines);
    }

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
  renderNodeMetadata(root, "  ", lines);

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
