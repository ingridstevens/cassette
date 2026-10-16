---
name: persona-vote
description: Have the ten AI user personas in docs/personas vote on proposed features, or test the app by following their first-run scripts. Use when the user asks to run a persona vote, prioritise features with personas, or persona-test a change.
---

# Persona vote

The personas in `docs/personas/*.md` (everything except `README.md`) are simulated users. This skill runs them as
independent voters or testers and writes the result into `docs/votes/` or `docs/testing-runs/`.

Simulated opinions are not evidence of demand. Say so in every results file.

## Vote mode

Input: a path to a proposals file (see `docs/votes/README.md`), or proposals pasted by the user. If there are none, ask for them.

1. Read `docs/personas/README.md` and the proposals. Give each feature an id (`F1`, `F2`, ...) if it has none.
2. Start **one subagent per persona, all in the same message so they run in parallel**. Do not run them one after another.
   Use a cheaper model if the harness lets you pick one. Each agent gets:
   - the full text of its own persona file, with the instruction "You are this person. Stay in character; judge only from your own needs, rewards, penalties and vetoes."
   - the proposals text
   - the output contract below
   - no other persona's file and no other votes (independence matters)
3. Each agent must return only JSON, an array with one object per feature:

   ```json
   {"feature": "F1", "score": 0-5, "would_use": "yes|sometimes|no", "veto": false, "veto_reason": "", "reason": "one sentence"}
   ```

   Scores: 0 harmful, 1 bad, 2 unwelcome, 3 neutral or nice to have, 4 valuable, 5 would choose the app for it. Set `veto: true` (and score 0) only when the feature meets a veto condition in the persona file, and quote that condition in `veto_reason`.
4. Parse the JSON. If an agent returned something unparseable or skipped a feature, re-ask that agent once; if it still fails, mark its cells `n/a` and say so.
5. Compute for each feature: mean score (ignore `n/a`), spread (max minus min), and the list of vetoes.
6. Write `docs/votes/YYYY-MM-DD-<topic>.md` with these sections in this order: a one-line caveat that the votes are simulated, **Vetoes**, **Ranking** (mean, spread), **Contested** (spread of 3 or more), a **per-persona table** (rows are features, columns are personas), **Recommendations**, **Notes**.

   **Recommendations is required, and every vote must end in one.** Group the personas' reasons (the "biggest thing I would change") into a numbered list of concrete changes, ordered by how many personas asked and how cheap the change is. Name who asked for each, mark what to do first, and say what you would not do and why. Before you write it, read the code involved and add a short "Check against the code" paragraph: personas guess, so say where a persona's claim about current behaviour is wrong. A vote with no recommendation is incomplete. Notes should mention relevant blind spots (for example Dev under-weights non-technical users) and any feature only one persona scored above 3.
7. Reply with the vetoes, the top three, and the contested features, and the file path. Do not decide for the user.

## Test mode

Input: a build or the browser mock, and optionally a persona or a change to focus on.

1. For each chosen persona (default: all ten), start one subagent in parallel with its persona file and its **First-run test script**.
2. The agent follows the script in the app (for a plain browser run `cd app && npx vite --port 5173` and open `http://localhost:5173/?ready`; `app/src/dev-mock.ts` fakes the engine) and acts as the persona would, using the browser tools and reading pages as text and accessibility tree where possible.
3. Each agent returns a list of findings: `{"step": "...", "severity": "blocker|friction|nit", "what_happened": "...", "persona_reaction": "..."}`, plus one line on whether they would keep using the app.
4. Write `docs/testing-runs/YYYY-MM-DD-<topic>.md`: blockers first, then friction grouped by theme, then nits. Note that the mock has made-up data, so findings about transcription accuracy, speed or real audio cannot come from a mock run.
5. Reply with the blockers and the file path.

## Rules

- Never show one persona another's output.
- Do not edit persona files during a vote.
- Do not file GitHub issues or push without being asked.
