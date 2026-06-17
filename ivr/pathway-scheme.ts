import type { Pathway } from "./tree-types.js";

const ROOT_KEY = "root";

/** Stable string key for a pathway, used as the graph map key. */
export function pathwayKey(pathway: Pathway): string {
  return pathway.length === 0 ? ROOT_KEY : pathway.join("/");
}

/** Pathway reached by pressing `key` from `parent`. */
export function childPathway(parent: Pathway, key: string): Pathway {
  return [...parent, key];
}

/** Parent pathway, or null at the root. */
export function parentPathway(pathway: Pathway): Pathway | null {
  if (pathway.length === 0) {
    return null;
  }
  return pathway.slice(0, -1);
}

/** Spec: each internal node is tracked as pathwayNumber:title (not shown in console output). */
export function formatNodeName(pathwayNumber: number, title: string): string {
  return `${pathwayNumber}:${title}`;
}

/** User-facing menu option: DTMF key + label. */
export function formatOption(key: string, label: string): string {
  return `${key}: ${label}`;
}

export interface PathwayRegistry {
  assign(pathway: Pathway): number;
  get(pathway: Pathway): number | undefined;
}

/** Assigns monotonically increasing pathway numbers, starting at 0 for root. */
export function createPathwayRegistry(): PathwayRegistry {
  let nextNumber = 0;
  const numbers = new Map<string, number>();

  return {
    assign(pathway: Pathway): number {
      const key = pathwayKey(pathway);
      const existing = numbers.get(key);
      if (existing !== undefined) {
        return existing;
      }

      const assigned = nextNumber;
      nextNumber += 1;
      numbers.set(key, assigned);
      return assigned;
    },

    get(pathway: Pathway): number | undefined {
      return numbers.get(pathwayKey(pathway));
    },
  };
}

export { ROOT_KEY };
