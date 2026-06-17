import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExploreStats } from "./explorer.js";
import { renderIvrTree } from "./print-tree.js";
import type { IvrTree } from "./tree-types.js";

const here = dirname(fileURLToPath(import.meta.url));
/** outputs/ lives at the project root (one level up from ivr/). */
const OUTPUTS_DIR = join(here, "..", "outputs");

/** Filesystem-safe timestamp like 2026-06-17T14-30-05. */
function fileTimestamp(date = new Date()): string {
  return date.toISOString().replace(/\.\d+Z$/, "").replace(/:/g, "-");
}

/** Keep digits (and a leading +) so the filename is stable and safe. */
function sanitizePhone(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/[^\d+]/g, "");
  return cleaned.replace(/^\+/, "") || "unknown";
}

function renderStats(stats: ExploreStats): string {
  return [
    "--- Exploration Stats ---",
    `Pathways explored: ${stats.pathwaysExplored}`,
    `Calls placed:      ${stats.callsPlaced}`,
    `Terminal nodes:    ${stats.terminals}`,
    `Loops detected:    ${stats.loops}`,
    `Looping options:   ${stats.loopGuarded}`,
    `Unknown options:   ${stats.unknownSkipped}`,
    `Same-as-parent:    ${stats.sameAsParentSkipped}`,
    `Spoken options:    ${stats.speakingSkipped}`,
    `Failures:          ${stats.failures}`,
    `Skipped (depth):   ${stats.skippedAtDepth}`,
  ].join("\n");
}

/**
 * Writes the rendered tree (plus exploration stats) to
 * outputs/<timestamp>_<phoneNumber>.txt and returns the file path.
 */
export async function writeTreeOutput(
  tree: IvrTree,
  stats?: ExploreStats,
): Promise<string> {
  await mkdir(OUTPUTS_DIR, { recursive: true });

  const fileName = `${fileTimestamp()}_${sanitizePhone(tree.phoneNumber)}.txt`;
  const filePath = join(OUTPUTS_DIR, fileName);

  const sections = [
    `IVR Tree Modeler — ${tree.phoneNumber}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    renderIvrTree(tree),
  ];
  if (stats) {
    sections.push("", renderStats(stats));
  }

  await writeFile(filePath, `${sections.join("\n")}\n`, "utf8");
  return filePath;
}
