import { pathwayKey } from "./pathway-scheme.js";

/** Pathway through the IVR as a sequence of pressed keys (spec: pathways as numbers). */
export type Pathway = string[];

/** A Bland call that touched this node — the evidence behind the node. */
export interface IvrNodeCall {
  callId: string;
  /** Bland's answered_by classification (human / voicemail / unknown / ...). */
  answeredBy?: string;
  status?: string;
  /** Call length in seconds, as reported by Bland. */
  durationSec?: number;
  recordingUrl?: string | null;
  /** Full concatenated transcript of the call. */
  transcript?: string;
  /** When this record was captured (ISO 8601). */
  timestamp: string;
}

/**
 * One menu option (key:label) discovered for a node, plus how reliably it showed
 * up across repeated exploration attempts. `confidence` is appearances/attempts.
 */
export interface OptionConfidence {
  key: string;
  label: string;
  /** Fraction of attempts (0..1) in which this exact key:label appeared. */
  confidence: number;
}

/** Directed edge from one menu node to another via a key press. */
export interface IvrEdge {
  key: string;
  label: string;
  /** Pathway after taking this edge. */
  targetPathway: Pathway;
  /** True when navigating back along this edge ends exploration (spec: reverse edge = tree end). */
  isReverse?: boolean;
  /** True when this option matches a sibling at the parent menu (a back-navigation shortcut). */
  isBackprop?: boolean;
}

/** A node in the IVR tree: pathway number + title, with outgoing edges. */
export interface IvrNode {
  pathway: Pathway;
  pathwayNumber: number;
  title: string;
  edges: IvrEdge[];
  /** Whether this node has been confirmed as a leaf (no further menus discovered). */
  isTerminal?: boolean;
  /** True once a call has actually listened to this node's menu. */
  explored?: boolean;
  /** True if every attempt to reach/explore this node failed. */
  failed?: boolean;
  /**
   * Set when this node's menu matches a menu already seen elsewhere (a loop).
   * Points at the canonical pathway whose menu this duplicates (spec: reverse edge = tree end).
   */
  loopTo?: Pathway;
  /**
   * True when this node is reached by a self-looping option (e.g. "need more
   * time", "repeat options"). Recorded in the graph but intentionally never
   * explored.
   */
  loopGuard?: boolean;
  /**
   * True when this node is reached by an option we can't confidently explore
   * (unknown/unclear label or a non-pressable key). Recorded but never explored.
   */
  unknownOption?: boolean;
  /**
   * True when this node's option label matches its parent's label (lowercased) —
   * a repeated/self-referential option. Recorded but never explored.
   */
  sameAsParent?: boolean;
  /**
   * True when this node is reached by an option whose label matches a sibling
   * option at the parent menu. Recorded as a backprop edge but never explored.
   */
  backpropEdge?: boolean;
  /**
   * True when this node is reached by a spoken option (e.g. say "agent"), not a
   * DTMF key press. Recorded as a leaf but never explored.
   */
  speakingOption?: boolean;
  /** Bland call id that discovered this node's menu, if any. */
  sourceCallId?: string;
  /** Every Bland call that touched this node (evidence + provenance). */
  calls: IvrNodeCall[];
  /** Number of successful exploration attempts aggregated for this node. */
  attempts?: number;
  /** The discovered key:label options and each one's confidence. */
  optionConfidences?: OptionConfidence[];
  /**
   * Overall confidence (0..1) in this node's menu: the mean of its options'
   * confidences (or, for a terminal, the share of attempts that agreed it had
   * no menu).
   */
  confidence?: number;
}

/** Graph/tree of discovered IVR menus keyed by pathway string. */
export interface IvrTree {
  /** Dialed number — the tree root identity. */
  phoneNumber: string;
  nodes: Map<string, IvrNode>;
  rootPathwayKey: string;
}

export function getNode(tree: IvrTree, pathway: Pathway): IvrNode | undefined {
  return tree.nodes.get(pathwayKey(pathway));
}

export function getRootNode(tree: IvrTree): IvrNode {
  const node = tree.nodes.get(tree.rootPathwayKey);
  if (!node) {
    throw new Error("IVR tree is missing its root node.");
  }
  return node;
}
