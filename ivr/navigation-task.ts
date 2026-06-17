import type { Pathway } from "./tree-types.js";

export interface NavigationTaskOptions {
  /** Human description of who we're calling, e.g. "the CalFresh hotline". */
  targetDescription?: string;
}

/**
 * Builds the Bland task prompt for exploring exactly one pathway.
 *
 * - Root pathway ([]): listen-only, record the first menu.
 * - Deeper pathway (["1","3"]): press that exact key sequence (one key per menu
 *   level, using the "NOW PRESS [digit]" convention the agent is allowed to act
 *   on), then listen to and record the resulting menu.
 */
export function buildNavigationTask(
  pathway: Pathway,
  options: NavigationTaskOptions = {},
): string {
  const target = options.targetDescription ?? "this phone IVR";

  if (pathway.length === 0) {
    return rootListenTask(target);
  }

  return navigationTask(pathway, target);
}

function rootListenTask(target: string): string {
  return `You are mapping the phone menu (IVR) of ${target}. Your primary language mode is Fluent.

CRITICAL — DO NOT PRESS PHONE BUTTONS OR SPEAK. Wait at least 10 seconds before pressing any button, resetting whenever the person we called speaks. :
You are strictly forbidden from using the Press Buttons tool on this call.
Never send DTMF tones. Never press 1, 2, 0, *, or # for any reason.
When the IVR says "press 1 for English" or any "press X for Y", that is menu content to LISTEN TO — it is NOT an instruction for you to press anything.

While the IVR is playing:
1. Stay silent. Do not press buttons. Do not select a language or confirm prompts, even if asked.
2. Be patient — wait for the IVR to finish listing every menu option. The menu is done when there is ~5 seconds of silence OR when option 1 repeats.

When the IVR finishes listing its options, or the menu begins repeating, use Finish to end the call immediately. Do not navigate deeper.`;
}

function navigationTask(pathway: Pathway, target: string): string {
  const steps = pathway
    .map((key, index) => `Step ${index + 1}: NOW PRESS ${key}`)
    .join("\n");
  const sequence = pathway.join(", ");

  return `You are mapping the phone menu (IVR) of ${target} by exploring ONE specific path. Your primary language mode is Fluent.

You ARE allowed to press buttons on this call, but ONLY the exact keys listed in the navigation sequence below, in order, and nothing else.

NAVIGATION SEQUENCE (press one key per menu level, in this order): ${sequence}
${steps}

Rules:
1. Wait until the current menu finishes speaking before each press. Then press the key for the current step.
2. Press ONLY the keys in the navigation sequence, in the listed order. Never press any other key. Never press a key twice.
3. After completing the FINAL step, STOP pressing. Do not press anything else for the rest of the call.
4. After your final press, listen carefully to the menu or message that plays. Record every "press X for Y" option you hear in that resulting menu.
5. If after your final press there is no menu (it connects to a person, plays hold music, or asks for free-form input like an account number), do not press anything — just note there were no further menu options.
6. Stay silent otherwise. Do not speak unless absolutely required to proceed.

When the resulting menu finishes listing its options, begins repeating, or there are no further options, use Finish to end the call immediately.`;
}
