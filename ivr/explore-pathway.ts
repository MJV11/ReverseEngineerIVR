import {
  sendCall,
  IVR_MENU_ANALYSIS_SCHEMA,
  type BlandLanguage,
  type BlandSendCallWithTask,
} from "../api/index.js";
import {
  waitForCallTranscript,
  type CallDetails,
} from "../scripts/get-call.js";
import { buildNavigationTask } from "./navigation-task.js";
import type { Pathway } from "./tree-types.js";

/** Shared call configuration for every exploration call. */
export interface ExploreCallConfig {
  phoneNumber: string;
  voice?: string;
  language?: BlandLanguage;
  /** Human description used in the task prompt, e.g. "the CalFresh hotline". */
  targetDescription?: string;
  /** Base call duration in seconds; deeper pathways add time automatically. */
  baseMaxDurationSec?: number;
  /** Max time to wait for a single call's transcript + analysis. */
  maxWaitMs?: number;
  /** Extra Bland call params, merged last (wins over defaults). */
  callOverrides?: Partial<BlandSendCallWithTask>;
}

export interface PathwayExploration {
  pathway: Pathway;
  callId: string;
  call: CallDetails;
  /** Extracted analysis, or null if the call produced none. */
  analysis: Record<string, unknown> | null;
}

const DEFAULT_VOICE = "384797b9-8676-40f7-ac12-35a0d3f1c5d4";

/** Hard cap: every call is terminated after 3 minutes. */
export const MAX_CALL_DURATION_SEC = 180;

function maxDurationFor(pathway: Pathway, base: number): number {
  // Each additional level needs time to navigate + listen to the next menu,
  // but never exceed the 3-minute hard cap.
  return Math.min(MAX_CALL_DURATION_SEC, base + pathway.length * 30);
}

/**
 * Explores a single pathway: places a navigation call, waits for it to finish,
 * and returns the post-call IVR analysis (spec §4 — call the number, proceed
 * down the path, extract the resulting menu).
 */
export async function explorePathway(
  pathway: Pathway,
  config: ExploreCallConfig,
): Promise<PathwayExploration> {
  const task = buildNavigationTask(pathway, {
    targetDescription: config.targetDescription,
  });

  const baseDuration = config.baseMaxDurationSec ?? 150;

  const request: BlandSendCallWithTask = {
    phone_number: config.phoneNumber,
    voice: config.voice ?? DEFAULT_VOICE,
    wait_for_greeting: true,
    record: true,
    answered_by_enabled: true,
    noise_cancellation: false,
    interruption_threshold: 200,
    block_interruptions: false,
    max_duration: maxDurationFor(pathway, baseDuration),
    model: "base",
    language: config.language ?? "fluent",
    background_track: "none",
    voicemail_action: "hangup",
    task,
    analysis_schema: IVR_MENU_ANALYSIS_SCHEMA,
    ...config.callOverrides,
  };

  const response = await sendCall(request);
  const call = await waitForCallTranscript(response.call_id, {
    maxWaitMs: config.maxWaitMs ?? 6 * 60_000,
    expectAnalysis: true,
  });

  return {
    pathway,
    callId: response.call_id,
    call,
    analysis: call.analysis ?? null,
  };
}
