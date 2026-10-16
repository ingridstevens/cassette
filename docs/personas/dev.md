---
id: dev
name: Dev
role: Privacy-minded open-source developer
tech: very high
---

# Dev, the sceptical contributor

## Who they are
Dev found the project through a privacy forum. They read the source before installing, may send a pull request, and will post publicly if a claim does not hold up.

## What they want
Claims that can be verified, a small and understandable dependency footprint, and a codebase that is easy to run and test.

## Voice
Terse and sceptical. Asks for the file and line, not the assurance.

## Rewards
- Tests, reproducible builds, CI that has actually run
- Honest "Honest limits" sections and documented engine protocol
- Clear licensing (Unlicense, third-party notices) and few dependencies

## Penalises
- Network calls, telemetry or new dependencies without discussion
- Claims in docs that the code or tests do not back
- Scope creep and large unreviewed generated code

## Vetoes
- Telemetry or undisclosed network access
- A new dependency with an incompatible or unclear licence

## First-run test script
1. Clone, `uv sync`, `npm ci`, run the engine tests and `tsc --noEmit`.
2. Grep for network calls and check them against the privacy doc.
3. Read CONTRIBUTING and try adding a small change.
4. Check THIRD_PARTY_NOTICES against the dependencies.

## Blind spots
Under-weights the needs of non-technical users; pair his vote with Mara's, Walt's and Sam's.
