# Persona votes

Results of asking the [personas](../personas/README.md) to vote on proposed features. One file per round,
named `YYYY-MM-DD-<topic>.md`.

The votes are **simulated**. Use them to see trade-offs and vetoes early, not as proof that people want something.

## How to run a round

In Claude Code, from the repository root:

```
/persona-vote docs/votes/proposals/<file>.md
```

or paste a few proposals after the command. The skill starts one agent per persona in parallel, collects their
scores, and writes the result here.

## A proposal

A proposal is a short list. For each feature give an id, a title and two or three sentences on what it does and what it costs
(for example: needs a new download, adds a network call, slows transcription).

```markdown
## F1 Batch export of all projects as one zip
Export every project's Word file and CSV in one go. Adds no network access. About 150 lines of code.
```

Look at [`proposals/_example.md`](proposals/_example.md).

## What each persona returns

For every feature: a score from 0 to 5, whether they would use it (yes, sometimes, no), a veto flag with a reason if one
of their veto conditions is met, and one sentence of rationale. 0 means harmful, 3 means neutral or nice to have,
5 means they would pick the app for it.

## The results file

| Section | Contents |
| --- | --- |
| Vetoes | Every veto, who raised it, and why. Read these first. |
| Ranking | Features by mean score, with the spread (highest minus lowest) |
| Contested | Features where the spread is 3 or more: decide these yourself |
| Per-persona table | Every score, so you can see who is for and who is against |
| Notes | Anything odd in the votes, and which personas' blind spots apply |

The mean is a hint, not a decision. A veto, a contested feature, or a feature only one persona cares about may matter more than a high mean.
