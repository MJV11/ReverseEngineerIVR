/** https://docs.bland.ai/api-v1/post/calls */

export type BlandModel = "base" | "turbo";

export type BlandLanguage =
  | "babel"
  | "fluent"
  | "en"
  | "babel-en"
  | "en-US"
  | "en-GB"
  | "en-AU"
  | "en-NZ"
  | "en-IN"
  | "es"
  | "babel-es"
  | "es-419"
  | "fr"
  | "babel-fr"
  | "fr-CA"
  | "de"
  | "babel-de"
  | "el"
  | "hi"
  | "hi-Latn"
  | "hu"
  | "ja"
  | "ko"
  | "ko-KR"
  | "vi"
  | "pt"
  | "pt-BR"
  | "pt-PT"
  | "zh"
  | "zh-CN"
  | "zh-Hans"
  | "zh-TW"
  | "zh-Hant"
  | "it"
  | "nl"
  | "pl"
  | "ru"
  | "sv"
  | "sv-SE"
  | "da"
  | "da-DK"
  | "fi"
  | "no"
  | "id"
  | "ms"
  | "tr"
  | "uk"
  | "bg"
  | "cs"
  | "ro"
  | "sk"
  | "auto";

export type BlandBackgroundTrack = "office" | "cafe" | "restaurant" | "none" | null;

export type BlandVoicemailAction = "hangup" | "leave_message" | "ignore";

export type BlandWebhookEvent =
  | "queue"
  | "call"
  | "latency"
  | "webhook"
  | "tool"
  | "dynamic_data"
  | "citations";

export type BlandDialingStrategy =
  | { type: "local" }
  | { type: "custom_pooling"; pool_id: string };

export interface BlandPronunciationGuideEntry {
  word: string;
  pronunciation: string;
  case_sensitive?: boolean;
  spaced?: boolean;
}

export interface BlandVoicemailSms {
  to: string;
  from: string;
  message: string;
}

export interface BlandVoicemailConfig {
  message?: string;
  action?: BlandVoicemailAction;
  sms?: BlandVoicemailSms;
  sensitive?: boolean;
}

export interface BlandRetryConfig {
  wait: number;
  voicemail_action?: BlandVoicemailAction;
  voicemail_message?: string;
}

export interface BlandDynamicDataEntry {
  url: string;
  method?: string;
  body?: unknown[];
  headers?: Array<{ key: string; value: string }>;
  query?: unknown[];
  cache?: boolean;
  response_data?: Array<{
    context?: string;
    data?: string;
    name?: string;
  }>;
}

/** Shared optional fields for all POST /v1/calls requests. */
export interface BlandSendCallBase {
  phone_number: string;
  voice?: string;
  first_sentence?: string;
  persona_id?: string;
  model?: BlandModel;
  language?: BlandLanguage;
  wait_for_greeting?: boolean;
  pronunciation_guide?: BlandPronunciationGuideEntry[];
  temperature?: number;
  interruption_threshold?: number;
  from?: string;
  dialing_strategy?: BlandDialingStrategy;
  timezone?: string;
  start_time?: string;
  transfer_phone_number?: string;
  transfer_list?: Record<string, string>;
  max_duration?: number;
  tools?: string[];
  background_track?: BlandBackgroundTrack;
  noise_cancellation?: boolean;
  block_interruptions?: boolean;
  record?: boolean;
  answered_by_enabled?: boolean;
  endpoint?: string;
  voicemail?: BlandVoicemailConfig;
  voicemail_action?: BlandVoicemailAction;
  citation_schema_ids?: string[];
  analysis_schema?: Record<string, string>;
  summary_prompt?: string;
  retry?: BlandRetryConfig;
  dispositions?: string[];
  request_data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  webhook?: string;
  webhook_events?: BlandWebhookEvent[];
  dynamic_data?: BlandDynamicDataEntry[] | null;
  keywords?: string[];
  ignore_button_press?: boolean;
  precall_dtmf_sequence?: string;
  guard_rails?: unknown[];
}

/** Task-based call (no pathway). */
export interface BlandSendCallWithTask extends BlandSendCallBase {
  task: string;
  pathway_id?: never;
  pathway_version?: never;
}

/** Pathway-based call (task omitted). */
export interface BlandSendCallWithPathway extends BlandSendCallBase {
  pathway_id: string;
  pathway_version?: number | "production" | "staging";
  task?: never;
}

export type BlandSendCallRequest = BlandSendCallWithTask | BlandSendCallWithPathway;

export interface BlandSendCallSuccessResponse {
  status: "success";
  message: string;
  call_id: string;
  batch_id: string | null;
}

export interface BlandSendCallErrorResponse {
  status: "error";
  message: string;
  errors?: string[];
}

export type BlandSendCallResponse =
  | BlandSendCallSuccessResponse
  | BlandSendCallErrorResponse;
