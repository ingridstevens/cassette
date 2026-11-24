# Testing with personas

Besides unit tests, the app can be checked from the point of view of its users. The ten [personas](personas/README.md)
each have a **first-run test script**: a short list of steps they would take, in their own words and with their own worries.

## Ways to use them

- **Persona test run.** In [Claude Code](https://claude.com/claude-code), run `/persona-vote` (a skill in `.claude/skills/persona-vote`; it does nothing outside Claude Code) and ask for test mode, or name a persona. One agent per
  persona follows its script in the app and reports blockers, friction and nits. Results go to `docs/testing-runs/`.
- **By hand.** Read a persona file, do its script, and write down where you hesitated. Useful before a release.
- **Before changing the interface.** Ask the personas to vote on the change ([Votes](votes/README.md)): Hana and Walt tend to catch what the
  rest miss.

## What the mock can and cannot tell you

Test runs in a browser use the mock in `app/src/dev-mock.ts`, which fakes the engine and returns made-up data. They can
find layout, wording, keyboard and flow problems. They cannot say anything about transcription accuracy, speed,
real audio, installation or model downloads. Those need a run in the real desktop app on a real machine.

## Automated end-to-end tests

`cd app && npm run e2e` runs the Playwright tests in `app/e2e/` in Chromium against the same mock (it installs the browser on
first run). They cover the main flow (add, Start, rename a speaker, edit a line, undo, export), a keyboard-only path, the
sample interview and the `?enginefail` error card. CI runs them on every push and pull request in the `e2e` job (Ubuntu only);
when one fails, the job uploads the Playwright report and traces as the `playwright-report` artifact.

### Engine test with real audio

`engine/tests/test_e2e.py` transcribes `docs/samples/test-interview-english-two-voices.m4a` with the real tiny model and checks the word
error rate against the written text (it must stay under 0.25; the measured score is 0.0 on a Mac). It is skipped unless the tiny model is
already on disk, and it never downloads anything itself, so a plain `uv run pytest` stays offline. CI runs it in the `engine-e2e` job
(Ubuntu only), which downloads the model once with `python -m engine models download tiny`, caches it in `~/.cache/cassette-models` (keyed
on `models.py`, where the model's commit is pinned) and sets `CASSETTE_E2E=1` so a missing model fails instead of skipping. A break in
`audio.decode` or the model path fails this job.

### Screenshot tests

`app/e2e/visual/` holds 12 screenshot tests: three screens (start, transcript, settings) in four looks (light, dark, Arabic
right to left, text at 150 percent), compared with a small tolerance (0.2 percent of the pixels). They run in the `visual` CI
job, inside the pinned Playwright container, so fonts and Chromium are identical; a failure uploads the expected, actual and
diff images as the `visual-report` artifact. The baselines in `app/e2e/visual/__screenshots__/` are only valid there: do not
make them on your own computer. After a deliberate layout change, run the `build` workflow by hand (Actions, Run workflow) with
"Update the visual baselines" ticked, download the `visual-baselines` artifact, put its files in that folder and commit them.
`npm run e2e` does not run these tests.

## Release checklist (manual)

1. Run each persona's script on the current build, and record the findings in `docs/testing-runs/`.
2. Fix or write down every blocker.
3. Re-check the veto conditions: no new network call or telemetry (Dr. Okafor, Dev), keyboard access intact (Hana), the de/fr/es text complete
   (Lucía; the check is `app/scripts/check-i18n.mjs`), models import and first run still work (Sam),
   a default that runs on an older Intel Mac (Walt).
4. Update the README's "Honest limits" if a test showed something new.
