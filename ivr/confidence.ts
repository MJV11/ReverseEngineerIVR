import type { IvrMenuOption } from "../api/ivr-analysis.js";
import { menuSignature } from "./menu-signature.js";
import type { OptionConfidence } from "./tree-types.js";

/** Canonical id for an option: trimmed key + normalized lowercase label. */
function optionId(option: IvrMenuOption): string {
  const key = option.key?.trim() ?? "";
  const label = (option.label ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,!?]+$/g, "");
  return `${key}|${label}`;
}

export interface AggregatedMenu {
  /** The most-common menu (the canonical set of options). */
  options: IvrMenuOption[];
  /** Per-option confidence for the canonical set. */
  optionConfidences: OptionConfidence[];
  /** Overall node confidence (mean of option confidences, or terminal agreement). */
  confidence: number;
  /** Number of attempts aggregated. */
  attempts: number;
}

/**
 * Aggregates several exploration attempts of the SAME pathway into one menu with
 * confidence scores.
 *
 * - The canonical menu is the most frequently seen option set (by signature).
 * - Each canonical option's confidence = (# attempts it appeared in) / attempts,
 *   where "appeared" means the same key + lowercased label.
 * - Overall node confidence = mean of the canonical options' confidences. For a
 *   terminal (empty) canonical menu, it's the share of attempts that agreed.
 */
export function aggregateMenuAttempts(
  attempts: IvrMenuOption[][],
): AggregatedMenu {
  const n = attempts.length;
  if (n === 0) {
    return { options: [], optionConfidences: [], confidence: 0, attempts: 0 };
  }

  // Tally how often each distinct menu (by signature) appeared, keeping a sample.
  const signatureCount = new Map<string, number>();
  const signatureSample = new Map<string, IvrMenuOption[]>();
  for (const options of attempts) {
    const signature = menuSignature(options);
    signatureCount.set(signature, (signatureCount.get(signature) ?? 0) + 1);
    if (!signatureSample.has(signature)) {
      signatureSample.set(signature, options);
    }
  }

  // Most common menu wins as the canonical result.
  let canonicalSignature = "";
  let canonicalCount = -1;
  for (const [signature, count] of signatureCount) {
    if (count > canonicalCount) {
      canonicalCount = count;
      canonicalSignature = signature;
    }
  }
  const canonical = signatureSample.get(canonicalSignature) ?? [];

  // Per-option confidence across ALL attempts (not just the canonical ones).
  const optionConfidences: OptionConfidence[] = canonical.map((option) => {
    const id = optionId(option);
    let appearances = 0;
    for (const options of attempts) {
      if (options.some((candidate) => optionId(candidate) === id)) {
        appearances += 1;
      }
    }
    return { key: option.key, label: option.label, confidence: appearances / n };
  });

  const confidence =
    optionConfidences.length > 0
      ? optionConfidences.reduce((sum, opt) => sum + opt.confidence, 0) /
        optionConfidences.length
      : canonicalCount / n;

  return { options: canonical, optionConfidences, confidence, attempts: n };
}
