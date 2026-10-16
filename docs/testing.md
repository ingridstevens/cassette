# Testing with personas

Besides unit tests, the app can be checked from the point of view of its users. The ten [personas](personas/README.md)
each have a **first-run test script**: a short list of steps they would take, in their own words and with their own worries.

## Ways to use them

- **Persona test run.** In Claude Code, run `/persona-vote` and ask for test mode, or name a persona. One agent per
  persona follows its script in the app and reports blockers, friction and nits. Results go to `docs/testing-runs/`.
- **By hand.** Read a persona file, do its script, and write down where you hesitated. Useful before a release.
- **Before changing the interface.** Ask the personas to vote on the change ([Votes](votes/README.md)): Hana and Walt tend to catch what the
  rest miss.

## What the mock can and cannot tell you

Test runs in a browser use the mock in `app/src/dev-mock.ts`, which fakes the engine and returns made-up data. They can
find layout, wording, keyboard and flow problems. They cannot say anything about transcription accuracy, speed,
real audio, installation or model downloads. Those need a run in the real desktop app on a real machine.

## Release checklist (manual)

1. Run each persona's script on the current build, and record the findings in `docs/testing-runs/`.
2. Fix or write down every blocker.
3. Re-check the veto conditions: no new network call or telemetry (Dr. Okafor, Dev), keyboard access intact (Hana), the de/fr/es text complete
   (Lucía; the check is `app/scripts/check-i18n.mjs`), models import and first run still work (Sam),
   a default that runs on an older Intel Mac (Walt).
4. Update the README's "Honest limits" if a test showed something new.
