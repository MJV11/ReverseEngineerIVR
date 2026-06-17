import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyAnalysisToTree,
  createEmptyTree,
  createPathwayRegistry,
  renderIvrTree,
} from "./index.js";

describe("renderIvrTree", () => {
  it("includes node metadata and edge flags in output", () => {
    const registry = createPathwayRegistry();
    const tree = createEmptyTree("+18009359935", "Welcome to Chase", registry);

    applyAnalysisToTree(
      tree,
      [],
      {
        ivr_options: [
          { key: "1", label: "Enter card or account number" },
          { key: "8", label: "Report lost card" },
        ],
      },
      { registry },
    );

    applyAnalysisToTree(
      tree,
      ["8"],
      {
        ivr_options: [{ key: "1", label: "enter card or account number" }],
      },
      { registry },
    );

    const node8 = tree.nodes.get("8");
    assert.ok(node8);
    node8.explored = true;
    node8.attempts = 3;
    node8.confidence = 0.67;
    node8.sourceCallId = "call-root-8";
    node8.optionConfidences = [{ key: "1", label: "enter card", confidence: 0.67 }];
    node8.calls.push({
      callId: "call-abc",
      status: "completed",
      durationSec: 42,
      answeredBy: "robot",
      recordingUrl: "https://example.com/rec",
      transcript: "Press 1 to enter your card.",
      timestamp: "2026-06-17T22:00:00.000Z",
    });

    const edge81 = node8.edges.find((edge) => edge.key === "1");
    assert.ok(edge81);
    edge81.isBackprop = true;

    const child81 = tree.nodes.get("8/1");
    assert.ok(child81);
    child81.backpropEdge = true;

    const output = renderIvrTree(tree);

    assert.match(output, /\/root · 0:root/);
    assert.match(output, /\/8 · \d+:.* · explored · attempts=3/);
    assert.match(output, /sourceCallId=call-root-8/);
    assert.match(output, /options: 1: enter card \(p=0\.67\)/);
    assert.match(output, /calls:/);
    assert.match(output, /call-abc · 42s · completed · answered_by=robot/);
    assert.match(output, /transcript:/);
    assert.match(output, /Press 1 to enter your card\./);
    assert.match(output, /1: enter card or account number.*\{isBackprop\}.*backprop edge/);
  });
});
