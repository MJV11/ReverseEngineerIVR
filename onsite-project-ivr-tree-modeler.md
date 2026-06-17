# Onsite Project — IVR Tree Modeler

**Role:** Full-Stack Engineer · **Time box:** ~4 hours
**First step:** Create a Bland account at [app.bland.ai](https://app.bland.ai) and grab your personal API key.
**Provided:** A list of toll-free (1-800) numbers that front real IVRs, and our [docs](https://docs.bland.ai). Use any LLM/AI provider you like for inference in your pipeline. You're also welcome to point the system at any other IVR number you find.

---

## The challenge

Most companies hide behind a phone tree (an **IVR**): *"Press 1 for billing, press 2 for support, say 'agent' to reach a representative…"*

Bland customers and prospects are often looking to replace their phone tree with AI. When we build POCs, we frequently use a company's existing IVR as a reference for designing an intelligent, capable AI voice agent — so being able to map one out is genuinely useful work.

Build a system that **reverse-engineers and models that tree**. Given a phone number, it should:

1. **Call the number** with the Bland voice API and capture the transcript.
2. **Detect whether the other end is a bot/IVR** (vs. a human or voicemail). If it's a bot, proceed.
3. **Explore the menus** by navigating them — listening to each prompt, pressing keys / speaking options, and following branches.
4. **Reconstruct and persist a structured model** of the tree.
5. **Measure and improve confidence** in the model through repeated or targeted exploration.

A single call only walks **one path** through the tree. Modeling the whole tree means orchestrating **many calls** and merging what you learn — that's the heart of the problem.

A **frontend that visualizes the tree is not required** to finish; treat it as a stretch goal if you have time.

---

## Whiteboarding

Part of the session is a whiteboard discussion with one of our engineers. You're encouraged to ask questions and talk through your design, tradeoffs, and how you'd extend the system. We care as much about your reasoning as your code.

---

## What we're evaluating

- **Queues / concurrency** — calls are slow and run in parallel; a frontier of unexplored branches gets worked by a bounded pool. Backpressure, retries, termination, cycle handling.
- **Inference** — turning a noisy transcript into structured menu options (prompt, choices, the digit/utterance for each, where it leads), and deciding whether a menu is one you've already seen.
- **System design** — how the explorer, work queue, Bland integration, and persistence fit together, and how you handle failure and async call completion.
- **Data modeling** — a schema for the discovered tree and the calls behind it that supports dedup/canonicalization, repeated/looping menus, confidence, and incremental refinement.

Plus the basics: does it actually model a tree end-to-end, and how well do you scope under time pressure.

---

## Bland API

You won't need much. Full docs: https://docs.bland.ai

- **`POST /v1/calls`** — place a call. Notably: `phone_number`, `task` (how to navigate, e.g. "press 2, then say 'billing'"), `wait_for_greeting`, `record`, `voicemail.action: "ignore"` (useful for IVRs).
- **`GET /v1/calls/{call_id}`** — transcript + metadata. `transcripts[]` entries carry a `user` field of `user` / `assistant` / `robot` / `agent-action`; also `answered_by`.

---

## Deliverables

1. **Running code** with instructions to run it.
2. **A short writeup** (½ page): architecture, data model, key tradeoffs, how you handle accuracy/refinement, and what you'd do with more time.
3. A **demo** modeling at least one IVR end-to-end (live or a recorded run).

## Stretch goals

- A frontend that visualizes the discovered tree and lets you inspect a node's prompt, options, source transcript, and confidence.
- Auto-generate a Bland [Pathway](https://docs.bland.ai/tutorials/pathways) from your discovered tree.
