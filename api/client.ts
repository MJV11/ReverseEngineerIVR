const DEFAULT_BASE_URL = "https://api.bland.ai";

export class BlandApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "BlandApiError";
    this.status = status;
    this.body = body;
  }
}

export interface BlandClientOptions {
  /** Defaults to process.env.BLAND_API_KEY */
  apiKey?: string;
  /** BYOT encrypted key header value */
  encryptedKey?: string;
  /** Defaults to https://api.bland.ai */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to global fetch) */
  fetch?: typeof fetch;
}

export interface BlandClient {
  apiKey: string;
  baseUrl: string;
  fetch: typeof fetch;
  headers: Record<string, string>;
}

export function createBlandClient(options: BlandClientOptions = {}): BlandClient {
  const apiKey = options.apiKey ?? process.env.BLAND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Bland API key is required. Pass apiKey or set BLAND_API_KEY.",
    );
  }

  const headers: Record<string, string> = {
    authorization: apiKey,
    "Content-Type": "application/json",
  };

  if (options.encryptedKey) {
    headers.encrypted_key = options.encryptedKey;
  }

  return {
    apiKey,
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    fetch: options.fetch ?? fetch,
    headers,
  };
}

export async function blandRequest<T>(
  client: BlandClient,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await client.fetch(`${client.baseUrl}${path}`, {
    ...init,
    headers: {
      ...client.headers,
      ...init?.headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Bland API request failed with status ${response.status}`;

    throw new BlandApiError(message, response.status, body);
  }

  return body as T;
}
