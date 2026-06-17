import type { IvrMenuOption } from "../api/ivr-analysis.js";

/**
 * Canonical signature of a menu, used to detect loops / already-seen menus
 * (spec §2: reverse edges). Two menus with the same set of keys and
 * normalized labels produce the same signature regardless of ordering.
 *
 * Returns "" for an empty menu — empty menus are leaves, never loops.
 */
export function menuSignature(options: IvrMenuOption[]): string {
  if (options.length === 0) {
    return "";
  }

  return options
    .map((option) => `${option.key.trim()}|${normalizeLabel(option.label)}`)
    .sort()
    .join("::");
}

function normalizeLabel(label: string | null | undefined): string {
  if (!label) {
    return "";
  }
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,!?]+$/g, "");
}
