import "dotenv/config";
import { exploreScript } from "./scripts/explore.js";
import { getCallScript } from "./scripts/get-call.js";
import { importTxtOutputScript } from "./scripts/import-txt-output.js";
import { writeDemoJsonScript } from "./scripts/write-demo-json.js";

const scripts: Record<string, (args: string[]) => Promise<unknown>> = {
  explore: exploreScript,
  "get-call": getCallScript,
  "write-demo-json": () => writeDemoJsonScript(),
  "import-txt-output": importTxtOutputScript,
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
