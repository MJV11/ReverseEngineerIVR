import { sendCall, IVR_MENU_ANALYSIS_SCHEMA } from "../api/index.js";
import { waitForCallTranscript } from "./get-call.js";

const TARGET_NUMBER = "+18009359935";

const TASK = `CRITICAL — DO NOT PRESS PHONE BUTTONS OR SPEAK:
You are strictly forbidden from using the Press Buttons tool unless this prompt contains an explicit line that says "NOW PRESS [digit]".
Never send DTMF tones. Never press 1, 2, 0, *, or # on your own.
When the IVR says "press 1 for English" or any "press X for Y", that is menu content to LISTEN TO — it is NOT an instruction for you to press anything. You are listening to the IVR, not acting as a caller navigating it.

Wrong: IVR says "press 1 for English" → you press 1.
Right: IVR says "press 1 for English" → you stay silent and keep listening.

You are calling the CalFresh hotline IVR. Your primary language mode is Fluent — listen and respond in clear English.

While the IVR is playing:
1. Stay silent. Use only the Speak tool if absolutely necessary — never Press Buttons.
2. Be patient — wait for the IVR to finish listing its menu options. This may take a while. It can be determined as over when there is silence for 5 seconds OR when we hear option 1 again.
3. Do not select a language, do not confirm prompts, do not enter numbers — even if the IVR asks callers to.

When the IVR stops listing menu options, or if the same menu starts repeating, use Finish to end the call immediately. Do not stay on the line or navigate deeper into the menu.

Future navigation (not active now):
You will only press buttons when a later instruction explicitly says "NOW PRESS [digit]." Until then, Press Buttons is off limits.`;

export async function callCalfresh() {
  console.log(`Placing call to CalFresh hotline (${TARGET_NUMBER})...`);

  const response = await sendCall({
    phone_number: TARGET_NUMBER,
    voice: "384797b9-8676-40f7-ac12-35a0d3f1c5d4",
    wait_for_greeting: true,
    record: true,
    answered_by_enabled: true,
    noise_cancellation: false,
    interruption_threshold: 200,
    block_interruptions: false,
    max_duration: 180,
    model: "base",
    language: "fluent",
    background_track: "none",
    voicemail_action: "hangup",
    task: TASK,
    analysis_schema: IVR_MENU_ANALYSIS_SCHEMA,
  });

  console.log("Call placed successfully:");
  console.log(JSON.stringify(response, null, 2));

  console.log("\nWaiting for call to finish, transcript, and IVR analysis...");
  return waitForCallTranscript(response.call_id, {
    maxWaitMs: 6 * 60_000,
    expectAnalysis: true,
  });
}
