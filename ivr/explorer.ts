import {
  parseIvrOptions,
  isLoopingOption,
  isSpeakingOption,
  isUnknownOption,
} from "../api/index.js";
import {
  applyAnalysisToTree,
  createEmptyTree,
} from "./build-tree-from-analysis.js";
import { aggregateMenuAttempts } from "./confidence.js";
import { createFrontier } from "./frontier.js";
import { menuSignature } from "./menu-signature.js";
import {
  explorePathway,
  type ExploreCallConfig,
} from "./explore-pathway.js";
import {
  createPathwayRegistry,
  parentPathway,
  pathwayKey,
} from "./pathway-scheme.js";
import {
  getNode,
  type IvrNode,
  type IvrTree,
  type Pathway,
} from "./tree-types.js";
import type { CallDetails } from "../scripts/get-call.js";

export interface ExploreIvrOptions extends ExploreCallConfig {
  /**
   * Minimum delay between firing off new workers. Concurrency is unbounded —
   * any number of calls can run at once — but a new one is only launched every
   * `launchIntervalMs`. Default 11000 (11 seconds).
   */
  launchIntervalMs?: number;
  /**
   * Optional safety cap on pathway depth (number of key presses). Defaults to
   * unlimited — the tree is explored to full depth. Set only as a guardrail.
   */
  maxDepth?: number;
  /**
   * Optional safety cap on total pathways explored. Defaults to unlimited — the
   * full breadth of the tree is explored. Set only as a guardrail against a
   * pathological/infinite IVR.
   */
  maxPathways?: number;
  /** Retry attempts per pathway on failure. Default 1. */
  maxRetries?: number;
  /**
   * How many times to independently re-explore each branch to build confidence.
   * Default 3 (fired `launchIntervalMs` apart). Higher = more reliable, slower.
   */
  attempts?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const IDLE_POLL_MS = 2_000;

export interface ExploreStats {
  pathwaysExplored: number;
  callsPlaced: number;
  terminals: number;
  loops: number;
  loopGuarded: number;
  unknownSkipped: number;
  sameAsParentSkipped: number;
  speakingSkipped: number;
  failures: number;
  skippedAtDepth: number;
}

export interface ExploreIvrResult {
  tree: IvrTree;
  stats: ExploreStats;
}

/** True when Bland's answered_by indicates a live human or voicemail, not a bot. */
function answeredByNonIvr(answeredBy: unknown): boolean {
  return answeredBy === "human" || answeredBy === "voicemail";
}

/** True when the post-call analysis explicitly says this wasn't an IVR. */
function analysisSaysNotIvr(analysis: Record<string, unknown>): boolean {
  return analysis.is_ivr === false || analysis.is_ivr === "false";
}

/** Label of the option that led into this pathway (its parent edge), if any. */
function incomingEdgeLabel(
  tree: IvrTree,
  pathway: Pathway,
): string | undefined {
  const parent = parentPathway(pathway);
  if (parent === null) {
    return undefined;
  }
  const parentNode = getNode(tree, parent);
  const key = pathway[pathway.length - 1];
  return parentNode?.edges.find((edge) => edge.key === key)?.label;
}

/** Append a call record to a node's evidence list. */
function recordNodeCall(
  node: IvrNode,
  callId: string,
  call: CallDetails | null,
): void {
  if (!callId) {
    return;
  }
  node.calls.push({
    callId,
    answeredBy: call?.answered_by ?? undefined,
    status: call?.status,
    durationSec: call?.call_length,
    recordingUrl: call?.recording_url ?? null,
    transcript: call?.concatenated_transcript,
    timestamp: new Date().toISOString(),
  });
}

function markIncomingEdgeReverse(tree: IvrTree, pathway: Pathway): void {
  const parent = parentPathway(pathway);
  if (parent === null) {
    return;
  }
  const parentNode = getNode(tree, parent);
  const key = pathway[pathway.length - 1];
  const edge = parentNode?.edges.find((candidate) => candidate.key === key);
  if (edge) {
    edge.isReverse = true;
  }
}

/**
 * Reverse-engineers an IVR tree by exploring pathways with a bounded pool of
 * concurrent Bland calls (spec §1–4).
 *
 * Loop: pop an unexplored pathway from the stack → place a call to navigate it →
 * transcribe + extract its menu → merge into the shared graph → push each newly
 * discovered child pathway back onto the stack. Repeats until the frontier is
 * empty, the call budget is spent, or every branch terminates/loops.
 */
export async function exploreIvrTree(
  options: ExploreIvrOptions,
): Promise<ExploreIvrResult> {
  const launchIntervalMs = Number.isFinite(options.launchIntervalMs)
    ? Math.max(0, options.launchIntervalMs as number)
    : 11_000;
  // Default to fully exploring the tree's depth and breadth. Natural
  // terminators (terminal menus, loop detection, the dedup'd frontier) bound
  // the search; these caps are optional guardrails only. Non-finite values
  // (undefined/NaN) mean "no cap".
  const maxDepth = Number.isFinite(options.maxDepth)
    ? Math.max(0, options.maxDepth as number)
    : Number.POSITIVE_INFINITY;
  const maxPathways = Number.isFinite(options.maxPathways)
    ? Math.max(1, options.maxPathways as number)
    : Number.POSITIVE_INFINITY;
  const maxRetries = Number.isFinite(options.maxRetries)
    ? Math.max(0, options.maxRetries as number)
    : 1;
  const attemptCount = Number.isFinite(options.attempts)
    ? Math.max(1, Math.floor(options.attempts as number))
    : 3;

  const registry = createPathwayRegistry();
  const tree = createEmptyTree(options.phoneNumber, "root", registry);
  const frontier = createFrontier([[]]); // seed with the root pathway
  const seenSignatures = new Map<string, Pathway>();

  const stats: ExploreStats = {
    pathwaysExplored: 0,
    callsPlaced: 0,
    terminals: 0,
    loops: 0,
    loopGuarded: 0,
    unknownSkipped: 0,
    sameAsParentSkipped: 0,
    speakingSkipped: 0,
    failures: 0,
    skippedAtDepth: 0,
  };

  let inFlight = 0;
  let budgetRemaining = maxPathways;
  // Set when the initial call reaches a non-IVR (human/voicemail): abort the run.
  let stopRequested = false;

  async function exploreWithRetries(pathway: Pathway) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        stats.callsPlaced += 1;
        const result = await explorePathway(pathway, options);
        if (result.analysis) {
          return result;
        }
        lastError = new Error("call produced no analysis");
      } catch (error) {
        lastError = error;
        console.warn(
          `[explore] attempt ${attempt + 1} failed for /${pathway.join("/") || "root"}: ${(error as Error).message}`,
        );
      }
    }
    return { pathway, callId: "", call: null, analysis: null, lastError } as const;
  }

  /**
   * Explore a pathway `attemptCount` times to build confidence. Calls are fired
   * `launchIntervalMs` apart but run concurrently, then we wait for all of them.
   */
  async function runAttempts(pathway: Pathway) {
    const pending: Array<ReturnType<typeof exploreWithRetries>> = [];
    for (let i = 0; i < attemptCount; i += 1) {
      pending.push(exploreWithRetries(pathway));
      if (i < attemptCount - 1) {
        await sleep(launchIntervalMs);
      }
    }
    return Promise.all(pending);
  }

  async function exploreOne(pathway: Pathway): Promise<void> {
    const label = `/${pathway.join("/") || "root"}`;
    console.log(
      `[explore] exploring ${label} (depth ${pathway.length}, ${attemptCount} attempts)`,
    );

    const results = await runAttempts(pathway);
    const successful = results.filter((result) => result.analysis);

    if (successful.length === 0) {
      const node = getNode(tree, pathway);
      if (node) {
        node.failed = true;
      }
      stats.failures += 1;
      console.warn(`[explore] giving up on ${label} (all attempts failed)`);
      return;
    }

    // Aggregate the attempts into one canonical menu + per-option confidence.
    const perAttemptOptions = successful.map((result) =>
      parseIvrOptions(result.analysis as Record<string, unknown>),
    );
    const aggregate = aggregateMenuAttempts(perAttemptOptions);

    const primary = successful[0];
    const canonicalAnalysis: Record<string, unknown> = {
      ...(primary.analysis as Record<string, unknown>),
      ivr_options: aggregate.options,
    };

    applyAnalysisToTree(tree, pathway, canonicalAnalysis, {
      registry,
      sourceCallId: primary.callId,
      phoneNumber: options.phoneNumber,
    });

    const node = getNode(tree, pathway);
    if (!node) {
      return;
    }
    node.explored = true;
    node.attempts = aggregate.attempts;
    node.optionConfidences = aggregate.optionConfidences;
    node.confidence = aggregate.confidence;
    for (const result of successful) {
      recordNodeCall(node, result.callId, result.call);
    }
    stats.pathwaysExplored += 1;
    console.log(
      `[explore] ${label} confidence ${aggregate.confidence.toFixed(2)} across ${aggregate.attempts} attempts`,
    );

    // On the initial (root) call: if the answerer isn't an IVR, abort the whole
    // process — there's no phone tree to map.
    if (pathway.length === 0) {
      if (
        answeredByNonIvr(primary.call?.answered_by) ||
        analysisSaysNotIvr(primary.analysis as Record<string, unknown>)
      ) {
        stopRequested = true;
        node.isTerminal = true;
        console.warn(
          `[explore] initial answerer is not an IVR (answered_by=${primary.call?.answered_by ?? "unknown"}, is_ivr=${String((primary.analysis as Record<string, unknown>).is_ivr)}) — terminating exploration`,
        );
        return;
      }
    }

    const menuOptions = aggregate.options;
    const signature = menuSignature(menuOptions);

    if (menuOptions.length === 0) {
      node.isTerminal = true;
      stats.terminals += 1;
      console.log(`[explore] ${label} is terminal (no menu)`);
      return;
    }

    // Loop detection: this menu matches one we've already mapped elsewhere.
    const existing = signature ? seenSignatures.get(signature) : undefined;
    if (existing && pathwayKey(existing) !== pathwayKey(pathway)) {
      node.loopTo = existing;
      markIncomingEdgeReverse(tree, pathway);
      stats.loops += 1;
      console.log(
        `[explore] ${label} loops back to /${existing.join("/") || "root"} — not recursing`,
      );
      return;
    }
    if (signature) {
      seenSignatures.set(signature, pathway);
    }

    if (pathway.length >= maxDepth) {
      stats.skippedAtDepth += node.edges.length;
      console.log(
        `[explore] ${label} reached max depth ${maxDepth} — not enqueuing ${node.edges.length} children`,
      );
      return;
    }

    // Label of this node (the option that led here, or the root prompt). Used to
    // skip children that just repeat the parent's label.
    const parentLabel = incomingEdgeLabel(tree, pathway) ?? node.title;

    for (const edge of node.edges) {
      if (budgetRemaining <= 0) {
        break;
      }

      // Guard against a child whose label matches its parent's (lowercased).
      if (
        parentLabel &&
        edge.label.trim().toLowerCase() === parentLabel.trim().toLowerCase()
      ) {
        const child = getNode(tree, edge.targetPathway);
        if (child) {
          child.sameAsParent = true;
        }
        stats.sameAsParentSkipped += 1;
        console.log(
          `[explore] ${label} option ${edge.key} ("${edge.label}") matches parent label — recording but not exploring`,
        );
        continue;
      }

      // Guard against self-looping options (more time / repeat). Record them in
      // the graph but never explore — pressing them just replays this menu.
      if (isLoopingOption(edge.label)) {
        const child = getNode(tree, edge.targetPathway);
        if (child) {
          child.loopGuard = true;
        }
        stats.loopGuarded += 1;
        console.log(
          `[explore] ${label} option ${edge.key} ("${edge.label}") is a looping option — recording but not exploring`,
        );
        continue;
      }

      // Spoken options (say "agent", etc.) are recorded as leaves but not
      // navigated — we only drive DTMF key presses.
      if (isSpeakingOption({ key: edge.key, label: edge.label })) {
        const child = getNode(tree, edge.targetPathway);
        if (child) {
          child.speakingOption = true;
        }
        stats.speakingSkipped += 1;
        console.log(
          `[explore] ${label} option "${edge.key}" ("${edge.label}") is a spoken option — recording but not exploring`,
        );
        continue;
      }

      // Guard against unknown/unpressable options. Record but never explore.
      if (isUnknownOption({ key: edge.key, label: edge.label })) {
        const child = getNode(tree, edge.targetPathway);
        if (child) {
          child.unknownOption = true;
        }
        stats.unknownSkipped += 1;
        console.log(
          `[explore] ${label} option ${edge.key} ("${edge.label}") is unknown/unpressable — recording but not exploring`,
        );
        continue;
      }

      frontier.push(edge.targetPathway);
    }
  }

  const launch = (pathway: Pathway): void => {
    budgetRemaining -= 1;
    inFlight += 1;
    void exploreOne(pathway)
      .catch((error) => {
        stats.failures += 1;
        console.error(
          `[explore] unexpected error on /${pathway.join("/") || "root"}:`,
          error,
        );
      })
      .finally(() => {
        inFlight -= 1;
      });
  };

  // Unbounded concurrency, but throttled launches: a new worker is fired off at
  // most once per `launchIntervalMs`. We keep looping while work is in flight,
  // since running workers enqueue new child pathways as they finish.
  while (true) {
    if (!stopRequested && budgetRemaining > 0 && !frontier.isEmpty()) {
      const pathway = frontier.pop();
      if (pathway) {
        launch(pathway);
        await sleep(launchIntervalMs);
        continue;
      }
    }

    // Nothing to launch right now. If workers are still running they may add
    // more pathways; wait and re-check. Otherwise we're done.
    if (inFlight === 0) {
      break;
    }
    await sleep(IDLE_POLL_MS);
  }

  return { tree, stats };
}
