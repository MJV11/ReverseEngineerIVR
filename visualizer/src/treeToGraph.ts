import dagre from "dagre";
import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";
import type { EdgeKind, SerializedIvrNode, SerializedIvrTree } from "./types";

export interface GraphNodeData extends Record<string, unknown> {
  node: SerializedIvrNode;
}

export interface GraphEdgeData extends Record<string, unknown> {
  kind: EdgeKind;
  key: string;
  label: string;
  optionConfidence?: number;
}

const NODE_WIDTH = 240;
const NODE_HEIGHT = 72;

function pathwayKey(pathway: string[]): string {
  return pathway.length === 0 ? "root" : pathway.join("/");
}

function formatPathway(pathway: string[]): string {
  return pathway.length === 0 ? "/root" : `/${pathway.join("/")}`;
}

function nodeKind(node: SerializedIvrNode): string {
  if (node.failed) return "failed";
  if (node.loopTo) return "loop-target";
  if (node.backpropEdge) return "backprop";
  if (node.loopGuard) return "loop-guard";
  if (node.speakingOption) return "spoken";
  if (node.unknownOption) return "unknown";
  if (node.sameAsParent) return "same-parent";
  if (node.isTerminal || (node.explored && node.edges.length === 0)) return "terminal";
  if (node.explored) return "explored";
  return "unexplored";
}

function nodeSummary(node: SerializedIvrNode): string {
  const badges: string[] = [];
  if (node.backpropEdge) badges.push("backprop");
  if (node.loopGuard) badges.push("loop guard");
  if (node.speakingOption) badges.push("spoken");
  if (node.unknownOption) badges.push("unknown");
  if (node.sameAsParent) badges.push("same as parent");
  if (node.loopTo) badges.push(`loops to ${formatPathway(node.loopTo)}`);
  return badges.join(" · ");
}

function edgeStyle(kind: EdgeKind): Partial<Edge<GraphEdgeData>> {
  switch (kind) {
    case "backprop":
      return {
        animated: true,
        style: { stroke: "#ea580c", strokeWidth: 2, strokeDasharray: "6 4" },
        labelStyle: { fill: "#9a3412", fontWeight: 600 },
        labelBgStyle: { fill: "#fff7ed" },
      };
    case "loop":
      return {
        animated: true,
        style: { stroke: "#7c3aed", strokeWidth: 2, strokeDasharray: "4 3" },
        labelStyle: { fill: "#5b21b6", fontWeight: 600 },
        labelBgStyle: { fill: "#f5f3ff" },
      };
    case "reverse":
      return {
        style: { stroke: "#dc2626", strokeWidth: 2, strokeDasharray: "2 4" },
        labelStyle: { fill: "#991b1b" },
        labelBgStyle: { fill: "#fef2f2" },
      };
    default:
      return {
        style: { stroke: "#64748b", strokeWidth: 1.5 },
        labelStyle: { fill: "#334155" },
        labelBgStyle: { fill: "#f8fafc" },
      };
  }
}

function layoutGraph(nodes: Node<GraphNodeData>[], edges: Edge<GraphEdgeData>[]) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 90, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    if (edge.data?.kind === "tree") {
      graph.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const positioned = graph.node(node.id);
    return {
      ...node,
      position: {
        x: positioned.x - NODE_WIDTH / 2,
        y: positioned.y - NODE_HEIGHT / 2,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });
}

export function treeToGraph(tree: SerializedIvrTree): {
  nodes: Node<GraphNodeData>[];
  edges: Edge<GraphEdgeData>[];
} {
  const nodeById = new Map(tree.nodes.map((node) => [node.id, node]));
  const nodes: Node<GraphNodeData>[] = tree.nodes.map((node) => ({
    id: node.id,
    type: "ivrNode",
    data: {
      node,
      kind: nodeKind(node),
      subtitle: nodeSummary(node),
      pathwayLabel: formatPathway(node.pathway),
      confidence: node.confidence,
    },
    position: { x: 0, y: 0 },
  }));

  const edges: Edge<GraphEdgeData>[] = [];
  const edgeIds = new Set<string>();

  function addEdge(
    sourceId: string,
    targetId: string,
    kind: EdgeKind,
    key: string,
    label: string,
    optionConfidence?: number,
  ) {
    if (!nodeById.has(sourceId) || !nodeById.has(targetId)) {
      return;
    }

    const id = `${sourceId}->${targetId}:${kind}:${key}`;
    if (edgeIds.has(id)) {
      return;
    }
    edgeIds.add(id);

    const edgeLabel =
      kind === "loop"
        ? `↩ loop to ${formatPathway(nodeById.get(targetId)!.pathway)}`
        : `${key}: ${label}${optionConfidence !== undefined ? ` (p=${optionConfidence.toFixed(2)})` : ""}`;

    edges.push({
      id,
      source: sourceId,
      target: targetId,
      type: "ivrEdge",
      label: edgeLabel,
      data: { kind, key, label, optionConfidence },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      ...edgeStyle(kind),
    });
  }

  for (const node of tree.nodes) {
    for (const edge of node.edges) {
      const kind: EdgeKind = edge.isBackprop
        ? "backprop"
        : edge.isReverse
          ? "reverse"
          : "tree";
      const optionConfidence = node.optionConfidences?.find(
        (option) => option.key === edge.key,
      )?.confidence;
      addEdge(
        node.id,
        pathwayKey(edge.targetPathway),
        kind,
        edge.key,
        edge.label,
        optionConfidence,
      );
    }

    if (node.loopTo) {
      addEdge(node.id, pathwayKey(node.loopTo), "loop", "loop", "loop");
    }
  }

  return {
    nodes: layoutGraph(nodes, edges),
    edges,
  };
}
