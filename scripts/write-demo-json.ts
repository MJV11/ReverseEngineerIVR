/**
 * Writes a demo JSON output from the print-tree test fixture so the visualizer
 * has something to load before the next explore run.
 *
 * Usage: npm start write-demo-json
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAnalysisToTree,
  createEmptyTree,
  createPathwayRegistry,
} from "../ivr/index.js";
import { serializeIvrTree } from "../ivr/serialize-tree.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUTPUTS_DIR = join(here, "..", "outputs");

export async function writeDemoJsonScript(): Promise<void> {
  const registry = createPathwayRegistry();
  const tree = createEmptyTree("+18009359935", "Welcome to Chase", registry);

  applyAnalysisToTree(
    tree,
    [],
    {
      ivr_options: [
        { key: "*", label: "need more time" },
        { key: "0", label: "Connect with customer service specialist" },
        { key: "1", label: "Enter card or account number" },
        { key: "2", label: "Other options" },
        { key: "8", label: "Report lost, stolen, or damaged debit card or unrecognized charges" },
      ],
    },
    { registry, sourceCallId: "demo-root" },
  );

  const root = tree.nodes.get("root")!;
  root.explored = true;
  root.attempts = 3;
  root.confidence = 0.78;
  root.optionConfidences = [
    { key: "*", label: "need more time", confidence: 1 },
    { key: "0", label: "Connect with customer service specialist", confidence: 0.33 },
    { key: "1", label: "Enter card or account number", confidence: 1 },
    { key: "2", label: "Other options", confidence: 0.67 },
    { key: "8", label: "Report lost, stolen, or damaged debit card or unrecognized charges", confidence: 0.67 },
  ];
  root.calls.push({
    callId: "demo-root",
    status: "completed",
    answeredBy: "robot",
    durationSec: 38,
    transcript: "Welcome to Chase. Press star if you need more time. Press zero to connect with a customer service specialist...",
    timestamp: "2026-06-17T22:18:50.000Z",
  });

  for (const key of ["0", "2", "8"]) {
    const node = tree.nodes.get(key)!;
    node.explored = true;
    node.attempts = 3;
    node.confidence = key === "8" ? 0.56 : 0.67;
    node.sourceCallId = `demo-${key}`;
    node.optionConfidences = [
      { key: "*", label: "need more time", confidence: 0.67 },
      { key: "1", label: key === "8" ? "enter card or account number" : "Enter card or account number", confidence: 0.67 },
    ];
    node.calls.push({
      callId: `demo-${key}`,
      status: "completed",
      answeredBy: "robot",
      durationSec: 41,
      transcript: `Submenu at pathway /${key}. Press 1 to enter card or account number.`,
      timestamp: "2026-06-17T22:18:50.000Z",
    });

    for (const edge of node.edges) {
      if (edge.key === "1") {
        edge.isBackprop = true;
        const child = tree.nodes.get(`${key}/1`)!;
        child.backpropEdge = true;
      }
    }
  }

  const star = tree.nodes.get("*")!;
  star.loopGuard = true;

  const node1 = tree.nodes.get("1")!;
  node1.loopTo = ["2"];

  if (tree.nodes.get("8/1")) {
    const node81 = tree.nodes.get("8/1")!;
    node81.backpropEdge = true;
  }

  await mkdir(OUTPUTS_DIR, { recursive: true });
  const fileName = "demo_chase_18009359935.json";
  const filePath = join(OUTPUTS_DIR, fileName);
  const payload = serializeIvrTree(tree, {
    pathwaysExplored: 5,
    callsPlaced: 15,
    terminals: 0,
    loops: 1,
    loopGuarded: 1,
    unknownSkipped: 0,
    sameAsParentSkipped: 0,
    backpropSkipped: 6,
    speakingSkipped: 1,
    failures: 0,
    skippedAtDepth: 0,
  });

  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote demo JSON to ${filePath}`);
}
