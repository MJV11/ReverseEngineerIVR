import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyAnalysisToTree,
  createEmptyTree,
  createPathwayRegistry,
} from "./index.js";
import { isBackpropEdge, markBackpropEdge } from "./backprop.js";
import { getNode } from "./tree-types.js";

/**
 * Tree shaped like outputs/2026-06-17T21-46-02_18009359935.txt (Chase IVR).
 * At /8, option 1 ("enter card or account number") is a backprop to root option 1.
 */
function buildChaseTreeFromOutput() {
  const registry = createPathwayRegistry();
  const tree = createEmptyTree(
    "+18009359935",
    "Welcome to Chase",
    registry,
  );

  applyAnalysisToTree(
    tree,
    [],
    {
      menu_prompt: "Welcome to Chase",
      ivr_options: [
        { key: "*", label: "need more time" },
        { key: "0", label: "Connect with customer service specialist" },
        { key: "1", label: "Enter card or account number" },
        { key: "2", label: "Other options" },
        {
          key: "8",
          label: "Report debit card lost, stolen, or damaged",
        },
      ],
    },
    { registry },
  );

  applyAnalysisToTree(
    tree,
    ["8"],
    {
      ivr_options: [
        { key: "*", label: "need more time" },
        { key: "1", label: "enter card or account number" },
        {
          key: "9-digit Social Security number or 9-digit tax ID number followed by the # key",
          label: "enter Social Security or tax ID number",
        },
      ],
    },
    { registry },
  );

  return tree;
}

describe("backprop edge detection", () => {
  it("flags /8/1 as backprop to root option 1 (Chase output)", () => {
    const tree = buildChaseTreeFromOutput();
    const node8 = getNode(tree, ["8"]);
    assert.ok(node8);

    const edge81 = node8.edges.find((edge) => edge.key === "1");
    assert.ok(edge81, "expected option 1 under /8");

    assert.equal(
      edge81.targetPathway.join("/"),
      "8/1",
      "edge should target pathway /8/1",
    );

    assert.ok(
      isBackpropEdge(tree, ["8"], edge81),
      "option 1 at /8 should backprop to root option 1",
    );

    assert.ok(markBackpropEdge(tree, ["8"], edge81));
    const child = getNode(tree, ["8", "1"]);
    assert.ok(child?.backpropEdge);
    assert.ok(edge81.isBackprop);
  });

  it("also flags /2/1 as backprop to root option 1", () => {
    const tree = buildChaseTreeFromOutput();

    applyAnalysisToTree(
      tree,
      ["2"],
      {
        ivr_options: [
          { key: "*", label: "need more time" },
          { key: "1", label: "enter card or account number" },
        ],
      },
      { registry: undefined },
    );

    const node2 = getNode(tree, ["2"]);
    assert.ok(node2);
    const edge21 = node2.edges.find((edge) => edge.key === "1");
    assert.ok(edge21);
    assert.ok(isBackpropEdge(tree, ["2"], edge21));
  });

  it("does not flag novel options at /8", () => {
    const tree = buildChaseTreeFromOutput();
    const node8 = getNode(tree, ["8"]);
    assert.ok(node8);

    const spokenEdge = node8.edges.find((edge) => edge.key.startsWith("9-digit"));
    assert.ok(spokenEdge);
    assert.ok(!isBackpropEdge(tree, ["8"], spokenEdge));
  });

  it("does not flag root children as backprop", () => {
    const tree = buildChaseTreeFromOutput();
    const root = getNode(tree, []);
    assert.ok(root);

    const edge1 = root.edges.find((edge) => edge.key === "1");
    assert.ok(edge1);
    assert.ok(!isBackpropEdge(tree, [], edge1));
  });
});
