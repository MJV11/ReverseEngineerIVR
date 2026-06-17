import { getCall, parseIvrOptions } from "../api/index.js";

const POLL_INTERVAL_MS = 30_000;
const TRANSCRIPT_GRACE_MS = 2 * 60_000;
const DEFAULT_MAX_WAIT_MS = 6 * 60_000;

export type CallDetails = Awaited<ReturnType<typeof getCall>>;

export interface WaitForCallTranscriptOptions {
  maxWaitMs?: number;
  pollIntervalMs?: number;
  expectAnalysis?: boolean;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "busy",
  "no-answer",
  "canceled",
  "unknown",
  "complete",
  "complete_error",
  "call_error",
  "queue_error",
  "pre_queue_error",
]);

const NO_TRANSCRIPT_STATUSES = new Set([
  "failed",
  "busy",
  "no-answer",
  "canceled",
  "queue_error",
  "pre_queue_error",
]);

function isCallEnded(call: CallDetails) {
  if (call.completed) {
    return true;
  }

  return (
    (call.status && TERMINAL_STATUSES.has(call.status)) ||
    (call.queue_status && TERMINAL_STATUSES.has(call.queue_status))
  );
}

function hasTranscript(call: CallDetails) {
  return (
    (call.transcripts?.length ?? 0) > 0 ||
    Boolean(call.concatenated_transcript?.trim())
  );
}

function shouldWaitForTranscript(call: CallDetails) {
  if (hasTranscript(call)) {
    return false;
  }

  if (call.status && NO_TRANSCRIPT_STATUSES.has(call.status)) {
    return false;
  }

  if (
    call.queue_status &&
    NO_TRANSCRIPT_STATUSES.has(call.queue_status)
  ) {
    return false;
  }

  const duration = Number(call.corrected_duration ?? call.call_length ?? 0);
  if (duration === 0 && call.status === "busy") {
    return false;
  }

  return isCallEnded(call);
}

function hasAnalysis(call: CallDetails) {
  return (
    call.analysis !== null &&
    call.analysis !== undefined &&
    typeof call.analysis === "object" &&
    Object.keys(call.analysis).length > 0
  );
}

function shouldWaitForAnalysis(call: CallDetails) {
  if (hasAnalysis(call)) {
    return false;
  }

  if (call.status && NO_TRANSCRIPT_STATUSES.has(call.status)) {
    return false;
  }

  if (
    call.queue_status &&
    NO_TRANSCRIPT_STATUSES.has(call.queue_status)
  ) {
    return false;
  }

  const duration = Number(call.corrected_duration ?? call.call_length ?? 0);
  if (duration === 0 && call.status === "busy") {
    return false;
  }

  return isCallEnded(call);
}

function isPostCallReady(call: CallDetails, expectAnalysis: boolean) {
  const transcriptReady =
    hasTranscript(call) || !shouldWaitForTranscript(call);

  if (!expectAnalysis) {
    return transcriptReady;
  }

  return transcriptReady && (hasAnalysis(call) || !shouldWaitForAnalysis(call));
}

export function printAnalysis(call: CallDetails) {
  if (!hasAnalysis(call)) {
    console.log("\nNo IVR analysis available yet.");
    return;
  }

  console.log("\n--- IVR Analysis ---");
  console.log(JSON.stringify(call.analysis, null, 2));

  const options = parseIvrOptions(call.analysis ?? {});
  if (options.length > 0) {
    console.log("\n--- Parsed Menu Options ---");
    for (const option of options) {
      console.log(`Press ${option.key} for ${option.label}`);
    }
  }
}

export function printTranscript(call: CallDetails) {
  console.log(`\n=== Call ${call.call_id} ===`);
  console.log(`Status: ${call.status ?? call.queue_status ?? "unknown"}`);
  console.log(`Answered by: ${call.answered_by ?? "unknown"}`);

  if (call.error_message) {
    console.log(`Error: ${call.error_message}`);
  }

  if (call.transcripts?.length) {
    console.log("\n--- Transcript ---");
    for (const entry of call.transcripts) {
      console.log(`[${entry.user}] ${entry.text}`);
    }
  } else if (call.concatenated_transcript) {
    console.log("\n--- Transcript ---");
    console.log(call.concatenated_transcript);
  } else {
    console.log("\nNo transcript available yet.");
  }

  if (call.summary) {
    console.log(`\nSummary: ${call.summary}`);
  }

  printAnalysis(call);
}

export async function waitForCallTranscript(
  callId: string,
  options: WaitForCallTranscriptOptions = {},
) {
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const deadline = Date.now() + maxWaitMs;
  let callEndedAt: number | null = null;

  const shouldExpectAnalysis = (call: CallDetails) =>
    options.expectAnalysis ?? Boolean(call.analysis_schema);

  while (Date.now() < deadline) {
    const call = await getCall(callId);
    const expectAnalysis = shouldExpectAnalysis(call);

    if (!isCallEnded(call)) {
      console.log(
        `Call in progress (${call.queue_status ?? call.status ?? "pending"})... checking again in ${pollIntervalMs / 1000}s`,
      );
      await sleep(pollIntervalMs);
      continue;
    }

    if (callEndedAt === null) {
      callEndedAt = Date.now();
    }

    if (isPostCallReady(call, expectAnalysis)) {
      printTranscript(call);
      return call;
    }

    const waitingFor: string[] = [];
    if (!hasTranscript(call) && shouldWaitForTranscript(call)) {
      waitingFor.push("transcript");
    }
    if (expectAnalysis && !hasAnalysis(call) && shouldWaitForAnalysis(call)) {
      waitingFor.push("analysis");
    }

    if (waitingFor.length === 0) {
      printTranscript(call);
      return call;
    }

    if (Date.now() - callEndedAt > TRANSCRIPT_GRACE_MS) {
      console.log(
        `Call finished but still waiting on: ${waitingFor.join(", ")}. Showing latest data:`,
      );
      printTranscript(call);
      return call;
    }

    console.log(
      `Call finished (${call.status ?? call.queue_status}). Waiting for ${waitingFor.join(" and ")}... checking again in ${pollIntervalMs / 1000}s`,
    );
    await sleep(pollIntervalMs);
  }

  const call = await getCall(callId);
  console.log("Timed out waiting for call/post-call data. Showing latest data:");
  printTranscript(call);
  return call;
}

export async function getCallScript(args: string[]) {
  const callId = args[0];

  if (!callId) {
    throw new Error("Usage: npm start get-call <call_id>");
  }

  return waitForCallTranscript(callId);
}
