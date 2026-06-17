import { pathwayKey } from "./pathway-scheme.js";
import type { Pathway } from "./tree-types.js";

/**
 * LIFO stack of unexplored pathways (spec §1). Each pathway is admitted at most
 * once for its entire lifetime, which guarantees termination and prevents two
 * workers from exploring the same branch.
 */
export interface ExplorationFrontier {
  /** Push a pathway. Returns false if it was already seen (and is therefore skipped). */
  push(pathway: Pathway): boolean;
  /** Pop the most recently pushed pathway, or undefined when empty. */
  pop(): Pathway | undefined;
  /** Number of pathways currently waiting to be explored. */
  readonly size: number;
  isEmpty(): boolean;
  /** Total distinct pathways ever admitted (waiting + already popped). */
  readonly seenCount: number;
}

export function createFrontier(seed: Pathway[] = []): ExplorationFrontier {
  const stack: Pathway[] = [];
  const seen = new Set<string>();

  const frontier: ExplorationFrontier = {
    push(pathway: Pathway): boolean {
      const key = pathwayKey(pathway);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      stack.push(pathway);
      return true;
    },
    pop(): Pathway | undefined {
      return stack.pop();
    },
    get size(): number {
      return stack.length;
    },
    isEmpty(): boolean {
      return stack.length === 0;
    },
    get seenCount(): number {
      return seen.size;
    },
  };

  for (const pathway of seed) {
    frontier.push(pathway);
  }

  return frontier;
}
