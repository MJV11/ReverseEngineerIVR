import { blandRequest, createBlandClient, type BlandClient } from "./client.js";
import type { BlandCallDetails } from "./types/call-details.js";
import type {
  BlandSendCallRequest,
  BlandSendCallResponse,
  BlandSendCallSuccessResponse,
} from "./types/calls.js";

export interface SendCallOptions {
  client?: BlandClient;
}

export interface GetCallOptions {
  client?: BlandClient;
}

/**
 * POST /v1/calls — send an AI phone call.
 * @see https://docs.bland.ai/api-v1/post/calls
 */
export async function sendCall(
  request: BlandSendCallRequest,
  options: SendCallOptions = {},
): Promise<BlandSendCallSuccessResponse> {
  const client = options.client ?? createBlandClient();

  const response = await blandRequest<BlandSendCallResponse>(client, "/v1/calls", {
    method: "POST",
    body: JSON.stringify(request),
  });

  if (response.status === "error") {
    const detail =
      response.errors?.length ? `: ${response.errors.join("; ")}` : "";
    throw new Error(`${response.message}${detail}`);
  }

  return response;
}

/**
 * GET /v1/calls/{call_id} — retrieve call details and transcript.
 * @see https://docs.bland.ai/api-v1/get/calls-id
 */
export async function getCall(
  callId: string,
  options: GetCallOptions = {},
): Promise<BlandCallDetails> {
  const client = options.client ?? createBlandClient();

  return blandRequest<BlandCallDetails>(
    client,
    `/v1/calls/${encodeURIComponent(callId)}`,
    { method: "GET" },
  );
}
