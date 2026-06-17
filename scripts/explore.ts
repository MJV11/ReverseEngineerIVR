import { exploreIvrTree, printIvrTree, writeTreeOutput } from "../ivr/index.js";

const DEFAULT_NUMBER = "+18009359935";

/**
 * Explore an IVR tree end-to-end to full depth and breadth: place a root call,
 * then recursively explore every discovered pathway. Concurrency is unbounded —
 * any number of calls run at once — but a new worker is launched at most once
 * every `launchIntervalSec` seconds. Exploration stops only at natural
 * boundaries (terminal menus, detected loops, exhausted frontier).
 *
 * Usage: npm start explore [phoneNumber] [attempts] [launchIntervalSec] [maxDepth] [maxPathways]
 *   - phoneNumber: number to dial (default demo number)
 *   - attempts: times to re-explore each branch for confidence (default 3)
 *   - launchIntervalSec: seconds between firing off new workers (default 11)
 *   - maxDepth / maxPathways: OPTIONAL safety guardrails; omit for full traversal
 */
function parsePhoneArg(arg: string | undefined): string {
  if (arg && /^\+?\d[\d\s()-]*$/.test(arg)) {
    return arg.startsWith("+") ? arg : `+${arg}`;
  }
  return DEFAULT_NUMBER;
}

function parseNumberArg(arg: string | undefined): number | undefined {
  if (arg === undefined) {
    return undefined;
  }
  const value = Number(arg);
  return Number.isFinite(value) ? value : undefined;
}

export async function exploreScript(args: string[]): Promise<void> {
  const phoneNumber = parsePhoneArg(args[0]);
  const attempts = parseNumberArg(args[1]);
  const launchIntervalSec = parseNumberArg(args[2]);
  const launchIntervalMs = (launchIntervalSec ?? 11) * 1000;
  const maxDepth = parseNumberArg(args[3]);
  const maxPathways = parseNumberArg(args[4]);

  console.log(
    `Exploring IVR at ${phoneNumber} (full depth + breadth, unbounded concurrency, ` +
      `${attempts ?? 3} attempts per branch, ` +
      `launching a worker every ${launchIntervalMs / 1000}s` +
      `${maxDepth !== undefined ? `, maxDepth=${maxDepth}` : ""}` +
      `${maxPathways !== undefined ? `, maxPathways=${maxPathways}` : ""})...`,
  );

  const { tree, stats } = await exploreIvrTree({
    phoneNumber,
    targetDescription: `the IVR at ${phoneNumber}`,
    attempts,
    launchIntervalMs,
    maxDepth,
    maxPathways,
  });

  printIvrTree(tree);

  console.log("\n--- Exploration Stats ---");
  console.log(`Pathways explored: ${stats.pathwaysExplored}`);
  console.log(`Calls placed:      ${stats.callsPlaced}`);
  console.log(`Terminal nodes:    ${stats.terminals}`);
  console.log(`Loops detected:    ${stats.loops}`);
  console.log(`Looping options:   ${stats.loopGuarded}`);
  console.log(`Unknown options:   ${stats.unknownSkipped}`);
  console.log(`Same-as-parent:    ${stats.sameAsParentSkipped}`);
  console.log(`Backprop edges:    ${stats.backpropSkipped}`);
  console.log(`Spoken options:    ${stats.speakingSkipped}`);
  console.log(`Failures:          ${stats.failures}`);
  console.log(`Skipped (depth):   ${stats.skippedAtDepth}`);

  const outputPath = await writeTreeOutput(tree, stats);
  const jsonPath = outputPath.replace(/\.txt$/, ".json");
  console.log(`\nSaved tree to ${outputPath}`);
  console.log(`Saved JSON to ${jsonPath}`);
}
