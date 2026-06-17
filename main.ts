import "dotenv/config";
import { callCalfresh } from "./scripts/call-calfresh.js";
import { exploreScript } from "./scripts/explore.js";
import { getCallScript } from "./scripts/get-call.js";

const scripts: Record<string, (args: string[]) => Promise<unknown>> = {
  explore: exploreScript,
  "call-calfresh": () => callCalfresh(),
  "get-call": getCallScript,
};

async function main() {
  const scriptName = process.argv[2] ?? "call-calfresh";
  const run = scripts[scriptName];

  if (!run) {
    console.error(`Unknown script: ${scriptName}`);
    console.error(`Available scripts: ${Object.keys(scripts).join(", ")}`);
    process.exit(1);
  }

  await run(process.argv.slice(3));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
