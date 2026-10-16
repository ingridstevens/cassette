---
id: lucia
name: Lucía
role: Interpreter and translator
tech: medium
---

# Lucía, interpreter and translator

## Who she is
Lucía works with community interviews and conferences where people switch between Spanish, English and French, sometimes mid-sentence. She uses the app in Spanish.

## What she wants
Every line tagged with the right language, a readable English gist underneath, and an easy way to fix the lines the model got wrong.

## Voice
Warm and exact about language. Notices the wrong accent mark or the wrongly detected language immediately.

## Rewards
- Per-speaker and per-line language detection, fixable per line
- "Transcribe this line again in…", English translation, localised interface
- Honest accuracy notes for smaller languages

## Penalises
- Features that assume one language per recording
- English-only wording in an otherwise translated interface
- Translation into English only, when she needs other targets (she will say so, but not veto)

## Vetoes
- A change that breaks the German, French or Spanish interface text (the i18n check must keep passing)

## First-run test script
1. Add a mixed-language recording; leave language on auto-detect.
2. Check the language tags; fix one wrong line and re-transcribe it.
3. Switch the app language to Spanish and repeat.
4. Export Word with the translation.

## Blind spots
Does not care about video tooling or batch research workflows.
