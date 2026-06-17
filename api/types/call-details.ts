/** https://docs.bland.ai/api-v1/get/calls-id */

export type BlandTranscriptSpeaker =
  | "user"
  | "assistant"
  | "robot"
  | "agent-action";

export interface BlandTranscriptEntry {
  id: number;
  created_at: string;
  text: string;
  user: BlandTranscriptSpeaker;
  c_id?: string;
  status?: string | null;
  transcript_id?: string | null;
}

export type BlandAnsweredBy =
  | "human"
  | "voicemail"
  | "unknown"
  | "no-answer"
  | null;

export type BlandCallStatus =
  | "completed"
  | "failed"
  | "busy"
  | "no-answer"
  | "canceled"
  | "unknown";

export interface BlandCallDetails {
  call_id: string;
  call_length?: number;
  batch_id?: string | null;
  to?: string;
  from?: string;
  completed?: boolean;
  created_at?: string;
  started_at?: string;
  end_at?: string;
  queue_status?: string;
  status?: BlandCallStatus;
  max_duration?: number;
  error_message?: string | null;
  answered_by?: BlandAnsweredBy;
  record?: boolean;
  recording_url?: string | null;
  summary?: string | null;
  analysis_schema?: Record<string, string> | null;
  analysis?: Record<string, unknown> | null;
  concatenated_transcript?: string;
  transcripts?: BlandTranscriptEntry[];
  corrected_duration?: string;
  [key: string]: unknown;
}
