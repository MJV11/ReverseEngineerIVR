import { parseIvrOptions, type IvrMenuOption } from "../api/ivr-analysis.js";
import {
  childPathway,
  createPathwayRegistry,
  pathwayKey,
  ROOT_KEY,
  type PathwayRegistry,
} from "./pathway-scheme.js";
import type { IvrEdge, IvrNode, IvrTree, Pathway } from "./tree-types.js";

export interface ApplyAnalysisOptions {
  registry?: PathwayRegistry;
  sourceCallId?: string;
  phoneNumber?: string;
}

function ensureNode(
  tree: IvrTree,
  pathway: Pathway,
  registry: PathwayRegistry,
  title: string,
  sourceCallId?: string,
): IvrNode {
  const key = pathwayKey(pathway);
  const existing = tree.nodes.get(key);

  if (existing) {
    if (title && existing.title !== title) {
      existing.title = title;
    }
    if (sourceCallId) {
      existing.sourceCallId = sourceCallId;
    }
    return existing;
  }

  const node: IvrNode = {
    pathway,
    pathwayNumber: registry.assign(pathway),
    title,
    edges: [],
    sourceCallId,
    calls: [],
  };
  tree.nodes.set(key, node);
  return node;
}

function mergeEdges(
  node: IvrNode,
  options: IvrMenuOption[],
  registry: PathwayRegistry,
  tree: IvrTree,
): void {
  const edgesByKey = new Map(node.edges.map((edge) => [edge.key, edge]));

  for (const option of options) {
    const targetPathway = childPathway(node.pathway, option.key);
    ensureNode(tree, targetPathway, registry, option.label);

    edgesByKey.set(option.key, {
      key: option.key,
      label: option.label,
      targetPathway,
    });
  }

  node.edges = [...edgesByKey.values()].sort((a, b) =>
    a.key.localeCompare(b.key, undefined, { numeric: true }),
  );
}

/** Creates an empty IVR tree with only the root node. */
export function createEmptyTree(
  phoneNumber: string,
  rootTitle = "root",
  registry: PathwayRegistry = createPathwayRegistry(),
): IvrTree {
  const tree: IvrTree = {
    phoneNumber,
    nodes: new Map(),
    rootPathwayKey: ROOT_KEY,
  };

  ensureNode(tree, [], registry, rootTitle);
  return tree;
}

/**
 * Transcribe discovered menu options from Bland analysis into the IVR graph (spec §3).
 * Creates or updates the node at `pathway` and adds edges for each press-X-for-Y option.
 */
export function applyAnalysisToTree(
  tree: IvrTree,
  pathway: Pathway,
  analysis: Record<string, unknown>,
  options: ApplyAnalysisOptions = {},
): IvrTree {
  const registry = options.registry ?? createPathwayRegistry();
  const menuPrompt =
    typeof analysis.menu_prompt === "string" ? analysis.menu_prompt : undefined;
  const title =
    pathway.length === 0
      ? menuPrompt?.trim() || "root"
      : (pathway[pathway.length - 1] ?? "unknown");

  const node = ensureNode(
    tree,
    pathway,
    registry,
    title,
    options.sourceCallId,
  );

  const ivrOptions = parseIvrOptions(analysis);
  if (ivrOptions.length === 0) {
    node.isTerminal = true;
    return tree;
  }

  mergeEdges(node, ivrOptions, registry, tree);
  return tree;
}

/** Builds a fresh tree from a single call's analysis at the root pathway. */
export function buildTreeFromAnalysis(
  analysis: Record<string, unknown>,
  options: ApplyAnalysisOptions = {},
): IvrTree {
  const registry = options.registry ?? createPathwayRegistry();
  const menuPrompt =
    typeof analysis.menu_prompt === "string" ? analysis.menu_prompt : undefined;
  const tree = createEmptyTree(
    options.phoneNumber ?? "unknown",
    menuPrompt?.trim() || "root",
    registry,
  );

  return applyAnalysisToTree(tree, [], analysis, {
    ...options,
    registry,
  });
}
