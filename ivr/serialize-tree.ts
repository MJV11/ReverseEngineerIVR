import type { ExploreStats } from "./explorer.js";
import { pathwayKey } from "./pathway-scheme.js";
import type { IvrEdge, IvrNode, IvrNodeCall, IvrTree, Pathway } from "./tree-types.js";

/** JSON-safe snapshot of an explored IVR tree for the visualizer. */
export interface SerializedIvrTree {
  phoneNumber: string;
  rootPathwayKey: string;
  generatedAt: string;
  stats?: ExploreStats;
  nodes: SerializedIvrNode[];
}

export interface SerializedIvrNode {
  id: string;
  pathway: Pathway;
  pathwayNumber: number;
  title: string;
  edges: IvrEdge[];
  isTerminal?: boolean;
  explored?: boolean;
  failed?: boolean;
  loopTo?: Pathway;
  loopGuard?: boolean;
  unknownOption?: boolean;
  sameAsParent?: boolean;
  backpropEdge?: boolean;
  speakingOption?: boolean;
  sourceCallId?: string;
  calls: IvrNodeCall[];
  attempts?: number;
  optionConfidences?: IvrNode["optionConfidences"];
  confidence?: number;
}

export function serializeIvrTree(
  tree: IvrTree,
  stats?: ExploreStats,
  generatedAt = new Date().toISOString(),
): SerializedIvrTree {
  const nodes = [...tree.nodes.values()]
    .sort((a, b) => a.pathwayNumber - b.pathwayNumber)
    .map((node): SerializedIvrNode => ({
      id: pathwayKey(node.pathway),
      pathway: node.pathway,
      pathwayNumber: node.pathwayNumber,
      title: node.title,
      edges: node.edges,
      isTerminal: node.isTerminal,
      explored: node.explored,
      failed: node.failed,
      loopTo: node.loopTo,
      loopGuard: node.loopGuard,
      unknownOption: node.unknownOption,
      sameAsParent: node.sameAsParent,
      backpropEdge: node.backpropEdge,
      speakingOption: node.speakingOption,
      sourceCallId: node.sourceCallId,
      calls: node.calls,
      attempts: node.attempts,
      optionConfidences: node.optionConfidences,
      confidence: node.confidence,
    }));

  return {
    phoneNumber: tree.phoneNumber,
    rootPathwayKey: tree.rootPathwayKey,
    generatedAt,
    stats,
    nodes,
  };
}
