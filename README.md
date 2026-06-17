# Bland IVR Tree Modeler

Reverse-engineers a phone tree (IVR) into a structured model. Given a phone
number, it calls the number with the [Bland](https://docs.bland.ai) voice API,
detects whether the other end is a bot, then explores the menus branch-by-branch
across many concurrent calls and merges what it learns into a single tree.

## How it works

1. **Call + transcribe** — places a Bland call and waits for the transcript.
2. **Detect IVR** — Bland post-call analysis (`is_ivr` + `answered_by`) decides
   whether we reached a phone tree. If the root call hits a human or voicemail,
   the whole run aborts.
3. **Explore** — every discovered `press X for Y` option becomes an unexplored
   pathway on a frontier (LIFO stack, deduplicated). Workers pop pathways and
   place navigation calls (`NOW PRESS <digit>`), unbounded in parallel but
   throttled to one new worker every ~11s (due to rate limits on calling the same number within 10 seconds).
4. **Model + persist** — each menu is a node in the tree; loops are detected via
   menu signatures. The final tree is printed and saved to `outputs/`.

### Guards (recorded but not explored)

To avoid wasting calls and looping forever, these options are recorded in the
tree as leaves but never navigated into:

- **Looping options** — "press * for more time", "press 9 to repeat options".
- **Spoken options** — "say 'agent'" (we only drive DTMF key presses).
- **Unknown options** — blank/unclear labels or keys.
- **Same-as-parent** — a child whose label matches its parent's (case-insensitive).

Every call is capped at 3 minutes (this is a shortcut assuming a hueristic for no menu taking longer than that to recite. Used because I am failing to get great or consistent outcomes from task prompting).

## Setup

Requires Node 18+.

```bash
npm install
cp .env.example .env
# then edit .env and set your Bland key:
# BLAND_API_KEY=your_key_here
```

Grab your API key from [app.bland.ai](https://app.bland.ai).

## Running

The entry point is `main.ts`, which dispatches to named scripts:

```bash
npm start <script> [args...]
```

### Explore an IVR end-to-end (main use case)

```bash
npm start explore [phoneNumber] [launchIntervalSec] [maxDepth] [maxPathways]
```

- `phoneNumber` — number to dial (default: `+18009359935`)
- `launchIntervalSec` — seconds between launching new workers (default: `11`)
- `maxDepth` / `maxPathways` — **optional** safety guardrails; omit for a full
  depth + breadth traversal

Examples:

```bash
npm start explore                 # explore the default demo number
npm start explore +18778473663    # explore a specific number
npm start explore +18778473663 11 # 11s between worker launches
```

### Other scripts

```bash
npm start call-calfresh           # single listen-only call to the CalFresh hotline
npm start get-call <callId>       # fetch a call's transcript + analysis
```

### Typecheck

```bash
npm run typecheck
```

## Output

After a run, the tree is printed to the console and written to:

```
outputs/<timestamp>_<phoneNumber>.txt
```

Each file contains the rendered tree (root = the dialed number, leaves =
`key: label`, annotated with status markers) followed by exploration stats.

## Project layout

```
main.ts                  # entry point / script dispatcher
api/                     # Bland API client, types, and IVR analysis schema
ivr/                     # tree model, frontier, explorer, rendering, output
scripts/                 # runnable scripts (explore, call-calfresh, get-call)
outputs/                 # saved tree text files (created on first run)
```
