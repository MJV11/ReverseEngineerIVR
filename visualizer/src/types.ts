export interface Pathway extends Array<string> {}

export interface IvrEdge {
  key: string;
  label: string;
  targetPathway: Pathway;
  isReverse?: boolean;
  isBackprop?: boolean;
}

export interface IvrNodeCall {
  callId: string;
  answeredBy?: string;
  status?: string;
  durationSec?: number;
  recordingUrl?: string | null;
  transcript?: string;
  timestamp: string;
}

export interface OptionConfidence {
  key: string;
  label: string;
  confidence: number;
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
  optionConfidences?: OptionConfidence[];
  confidence?: number;
}

export interface ExploreStats {
  pathwaysExplored: number;
  callsPlaced: number;
  terminals: number;
  loops: number;
  loopGuarded: number;
  unknownSkipped: number;
  sameAsParentSkipped: number;
  backpropSkipped: number;
  speakingSkipped: number;
  failures: number;
  skippedAtDepth: number;
}

export interface SerializedIvrTree {
  phoneNumber: string;
  rootPathwayKey: string;
  generatedAt: string;
  stats?: ExploreStats;
  nodes: SerializedIvrNode[];
}

export type EdgeKind = "tree" | "backprop" | "loop" | "reverse";
