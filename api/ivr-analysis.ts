/** Post-call analysis_schema for extracting IVR menu options from a transcript. */

export const IVR_MENU_ANALYSIS_SCHEMA: Record<string, string> = {
  is_ivr:
    "boolean — true if the other party was an automated phone menu, false if human or voicemail",
  menu_prompt:
    "string — short summary of the main IVR greeting or menu context",
  ivr_options:
    'JSON string: array of {"key":"1","label":"English"} objects for every option the IVR robot announced. For "press X for Y" options, key is the digit (e.g. "1", "0", "*", "#"). For SPOKEN options where the caller is told to SAY a word (e.g. "say \'agent\' for a representative"), set key to the exact word/phrase to say (e.g. "agent") — do NOT invent a digit. label is a short English summary of where the option leads. IMPORTANT: if an option is for getting/requesting more time or "I am still here" (e.g. "press * for more time"), set its label EXACTLY to "need more time". If an option is for repeating, replaying, or hearing the menu/options again (e.g. "press 9 to repeat these options"), set its label EXACTLY to "repeat options". These exact labels are required so the caller can avoid looping on them.',
};

export interface IvrMenuOption {
  key: string;
  label: string;
}

/**
 * True for options that just loop the caller in place (e.g. "more time",
 * "repeat options"). These are recorded in the graph but never explored,
 * since pressing them would re-play a menu we've already mapped.
 */
export function isLoopingOption(label: string): boolean {
  const normalized = label.toLowerCase();
  return normalized.includes("time") || normalized.includes("repeat");
}

/**
 * True for options we can't confidently explore: missing/blank key or label, or
 * an explicitly "unknown"/"unclear" label. Recorded in the graph but never
 * explored. (Note: a non-DTMF key alone is NOT unknown — that's a spoken option;
 * see `isSpeakingOption`.)
 */
export function isUnknownOption(option: IvrMenuOption): boolean {
  const key = option.key?.trim() ?? "";
  const label = option.label?.trim().toLowerCase() ?? "";

  if (!key || !label) {
    return true;
  }
  if (key.toLowerCase() === "unknown") {
    return true;
  }
  if (label.includes("unknown") || label.includes("unclear")) {
    return true;
  }
  return false;
}

/**
 * True for spoken options — the caller is asked to SAY a word/phrase (e.g. say
 * "agent") rather than press a DTMF key. The key isn't a pressable digit, *, or #
 * sequence. We record these as leaves but don't navigate into them.
 */
export function isSpeakingOption(option: IvrMenuOption): boolean {
  const key = option.key?.trim() ?? "";
  if (!key) {
    return false;
  }
  return !/^[0-9*#]+$/.test(key);
}

export interface IvrMenuAnalysis {
  is_ivr?: boolean;
  menu_prompt?: string;
  ivr_options?: string | IvrMenuOption[];
}

export function parseIvrOptions(
  analysis: IvrMenuAnalysis | Record<string, unknown>,
): IvrMenuOption[] {
  const raw = analysis.ivr_options;

  const isValidOption = (option: unknown): option is IvrMenuOption =>
    typeof option === "object" &&
    option !== null &&
    typeof (option as Record<string, unknown>).key === "string" &&
    (option as Record<string, unknown>).key !== "" &&
    typeof (option as Record<string, unknown>).label === "string" &&
    (option as Record<string, unknown>).label !== "";

  if (Array.isArray(raw)) {
    return raw.filter(isValidOption);
  }

  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidOption) : [];
  } catch {
    return [];
  }
}
