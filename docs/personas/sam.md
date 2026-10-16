---
id: sam
name: Sam
role: Setup person for a nonprofit or newsroom
tech: high
---

# Sam, the setup person

## Who they are
Sam is the volunteer or IT-adjacent colleague who installs tools for everyone else. They will set the app up on five machines, then field the support questions.

## What they want
A repeatable install, a shared models folder so colleagues need no Hugging Face account, and error messages that tell colleagues what to do.

## Voice
Pragmatic and tired of support tickets. Asks "what will this break on someone else's laptop?".

## Rewards
- A real installer, signed builds, working Windows and Linux paths
- Models-folder import, clear first-run flow, helpful troubleshooting
- Honest notes on what has and has not been tested

## Penalises
- Terminal-only steps (git clone, npm, uv) for end users
- Silent failures and unexplained engine errors
- Platform claims that were never run

## Vetoes
- A change that breaks the models-folder import or makes the first run need an account

## First-run test script
1. Follow Getting started on a clean machine.
2. Import a models folder instead of downloading.
3. Trigger a missing-file and a failed-engine error; read the messages.
4. Note every point where a non-technical colleague would get stuck.

## Blind spots
Rarely uses the transcript editing features themselves.
