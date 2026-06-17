/**
 * Builds a visualizer JSON snapshot from a rendered tree .txt file.
 * Transcripts are not recoverable from .txt — structure, options, and confidence are.
 *
 * Usage: npm start import-txt-output [fileName]
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { SerializedIvrTree, SerializedIvrNode } from "../ivr/serialize-tree.js";
import type { ExploreStats } from "../ivr/explorer.js";
import type { IvrEdge, Pathway } from "../ivr/tree-types.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUTPUTS_DIR = join(here, "..", "outputs");

interface ParsedLine {
  depth: number;
  key: string;
  label: string;
  optionConfidence?: number;
  nodeConfidence?: number;
  loopGuard?: boolean;
  backpropEdge?: boolean;
  speakingOption?: boolean;
  unknownOption?: boolean;
  sameAsParent?: boolean;
  loopTo?: Pathway;
  explored?: boolean;
}

function pathwayKey(pathway: Pathway): string {
  return pathway.length === 0 ? "root" : pathway.join("/");
}

function parseTreeLines(body: string): ParsedLine[] {
  const lines = body.split("\n");
  const parsed: ParsedLine[] = [];
  let inTree = false;

  for (const raw of lines) {
    if (raw.startsWith("--- IVR Tree ---")) {
      inTree = true;
      continue;
    }
    if (!inTree || raw.startsWith("---")) {
      continue;
    }

    const rootMatch = raw.match(/^(\+\d+) — (.+?)(?: \[conf ([\d.]+)\])?$/);
    if (rootMatch) {
      parsed.push({
        depth: 0,
        key: "root",
        label: rootMatch[2],
        nodeConfidence: rootMatch[3] ? Number(rootMatch[3]) : undefined,
        explored: true,
      });
      continue;
    }

    const edgeMatch = raw.match(/^((?:│   |    )*)(├── |└── )(.+)$/);
    if (!edgeMatch) {
      continue;
    }

    const prefix = edgeMatch[1];
    const rest = edgeMatch[3];
    const depth =
      (prefix.match(/│   /g)?.length ?? 0) +
      (prefix.match(/    /g)?.length ?? 0) +
      1;

    const colonIndex = rest.indexOf(": ");
    if (colonIndex === -1) {
      continue;
    }

    const key = rest.slice(0, colonIndex).trim();
    let tail = rest.slice(colonIndex + 2);

    let optionConfidence: number | undefined;
    const optionConfMatch = tail.match(/ \(p=([\d.]+)\)/);
    if (optionConfMatch) {
      optionConfidence = Number(optionConfMatch[1]);
      tail = tail.replace(/ \(p=[\d.]+\)/, "");
    }

    let nodeConfidence: number | undefined;
    const confMatch = tail.match(/ \[conf ([\d.]+)\]/);
    if (confMatch) {
      nodeConfidence = Number(confMatch[1]);
      tail = tail.replace(/ \[conf [\d.]+\]/, "");
    }

    const markerMatch = tail.match(/ \((.+)\)$/);
    const marker = markerMatch?.[1] ?? "";
    const label = markerMatch ? tail.slice(0, markerMatch.index).trim() : tail.trim();

    const loopMatch = marker.match(/↩ loops to \/(.+)/);
    const loopTo: Pathway | undefined = loopMatch
      ? loopMatch[1] === "root"
        ? []
        : loopMatch[1].split("/")
      : undefined;

    parsed.push({
      depth,
      key,
      label,
      optionConfidence,
      nodeConfidence,
      loopGuard: marker.includes("looping option"),
      backpropEdge: marker.includes("backprop edge"),
      speakingOption: marker.includes("spoken option"),
      unknownOption: marker.includes("unknown option"),
      sameAsParent: marker.includes("same as parent"),
      loopTo,
      explored: !marker.includes("unexplored") || nodeConfidence !== undefined || !!loopTo,
    });
  }

  return parsed;
}

function buildTreeFromParsed(
  phoneNumber: string,
  generatedAt: string,
  stats: ExploreStats | undefined,
  parsed: ParsedLine[],
): SerializedIvrTree {
  const nodes = new Map<string, SerializedIvrNode>();
  const pathwayStack: Pathway[] = [[]];
  let nextNumber = 0;

  function ensureNode(pathway: Pathway, title: string): SerializedIvrNode {
    const id = pathwayKey(pathway);
    const existing = nodes.get(id);
    if (existing) {
      if (title && existing.title !== title) {
        existing.title = title;
      }
      return existing;
    }
    const node: SerializedIvrNode = {
      id,
      pathway: [...pathway],
      pathwayNumber: nextNumber++,
      title,
      edges: [],
      calls: [],
    };
    nodes.set(id, node);
    return node;
  }

  const rootLine = parsed[0];
  if (!rootLine || rootLine.key !== "root") {
    throw new Error("Expected root line in tree output");
  }

  const root = ensureNode([], rootLine.label);
  root.explored = true;
  root.confidence = rootLine.nodeConfidence;
  root.attempts = stats?.pathwaysExplored ? 3 : undefined;
  root.optionConfidences = [];

  for (let index = 1; index < parsed.length; index += 1) {
    const line = parsed[index];
    pathwayStack.length = line.depth;
    const parentPathway = pathwayStack[pathwayStack.length - 1] ?? [];
    const parent = ensureNode(parentPathway, nodes.get(pathwayKey(parentPathway))?.title ?? "menu");

    const childPathway = [...parentPathway, line.key];
    pathwayStack.push(childPathway);

    const child = ensureNode(childPathway, line.label);
    child.loopGuard = line.loopGuard;
    child.backpropEdge = line.backpropEdge;
    child.speakingOption = line.speakingOption;
    child.unknownOption = line.unknownOption;
    child.sameAsParent = line.sameAsParent;
    child.loopTo = line.loopTo;
    child.explored = line.explored && !line.loopGuard && !line.backpropEdge && !line.speakingOption;
    child.confidence = line.nodeConfidence;
    child.attempts = child.explored ? 3 : undefined;

    const edge: IvrEdge = {
      key: line.key,
      label: line.label,
      targetPathway: childPathway,
      isBackprop: line.backpropEdge,
    };

    if (!parent.edges.some((existing) => existing.key === line.key)) {
      parent.edges.push(edge);
    }

    if (line.optionConfidence !== undefined) {
      parent.optionConfidences ??= [];
      if (!parent.optionConfidences.some((option) => option.key === line.key)) {
        parent.optionConfidences.push({
          key: line.key,
          label: line.label,
          confidence: line.optionConfidence,
        });
      }
    }
  }

  return {
    phoneNumber,
    rootPathwayKey: "root",
    generatedAt,
    stats,
    nodes: [...nodes.values()].sort((a, b) => a.pathwayNumber - b.pathwayNumber),
  };
}

function parseStats(body: string): ExploreStats | undefined {
  const get = (label: string): number => {
    const match = body.match(new RegExp(`${label}:\\s+(\\d+)`));
    return match ? Number(match[1]) : 0;
  };

  if (!body.includes("--- Exploration Stats ---")) {
    return undefined;
  }

  return {
    pathwaysExplored: get("Pathways explored"),
    callsPlaced: get("Calls placed"),
    terminals: get("Terminal nodes"),
    loops: get("Loops detected"),
    loopGuarded: get("Looping options"),
    unknownSkipped: get("Unknown options"),
    sameAsParentSkipped: get("Same-as-parent"),
    backpropSkipped: get("Backprop edges"),
    speakingSkipped: get("Spoken options"),
    failures: get("Failures"),
    skippedAtDepth: get("Skipped \\(depth\\)"),
  };
}

export async function importTxtOutputScript(args: string[]): Promise<void> {
  const fileName = args[0] ?? "2026-06-17T22-18-50_18009359935.txt";
  const txtPath = join(OUTPUTS_DIR, fileName);
  const jsonPath = txtPath.replace(/\.txt$/, ".json");

  const body = await readFile(txtPath, "utf8");
  const phoneMatch = body.match(/^IVR Tree Modeler — (.+)$/m);
  const generatedMatch = body.match(/^Generated: (.+)$/m);
  if (!phoneMatch || !generatedMatch) {
    throw new Error(`Could not parse header from ${fileName}`);
  }

  const parsed = parseTreeLines(body);
  const tree = buildTreeFromParsed(
    phoneMatch[1],
    generatedMatch[1],
    parseStats(body),
    parsed,
  );

  await writeFile(jsonPath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
  console.log(`Wrote ${jsonPath}`);
}
