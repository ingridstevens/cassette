# Persona vote: find and replace bar (2026-10-16)

> The votes are simulated by AI personas. They show trade-offs, not real demand. Proposal: [2026-10-16-find-and-replace-bar.md](proposals/2026-10-16-find-and-replace-bar.md) (the bar as it ships, judged from a screenshot where searching "deutsche" in a German transcript shows "No matches").

## Vetoes
None.

## Ranking

| Feature | Mean | Spread (max − min) |
| --- | --- | --- |
| F1 Find box, match navigation and Replace | 2.9 | 2 (Mara 4; Sam and Dr. Okafor 2) |

## Contested
None (no spread of 3 or more). Sam and Dr. Okafor are lowest, but for different reasons: Sam rarely edits transcripts, and Dr. Okafor wants storage of original and edited text explained.

## Scores

| Persona | Score | Would use | Reason |
| --- | --- | --- | --- |
| Mara | 4 | yes | Likes Edited, undo and Original vs. edited. Wants Replace all to show each affected line, and whether it touches an unsure word, first. |
| Jonas | 3 | sometimes | Wants whole-word and case-sensitive options and a Replace all preview with a count, to avoid over-matching across many interviews. |
| Priya | 3 | sometimes | A bare "No matches" is a dead end; wants near-miss or word-ending suggestions. Likes the Edited marker and undo. |
| Theo | 3 | sometimes | Wants whole-word and fuzzy matching. "No matches" leaves him hunting by hand. |
| Lucía | 3 | sometimes | Search ignores capitals but not accents, and has no fuzzy matching; wants accent-insensitive search and a reason for no matches. |
| Sam | 2 | no | Rarely edits transcripts. "No matches" with no hint generates support questions. |
| Hana | 3 | sometimes | Wants the small round arrows as labelled buttons with visible focus, and the match count and "No matches" in a live region. |
| Dr. Okafor | 2 | sometimes | Docs do not say whether original and edited text are stored or deletable. "No matches" does not say whether the text was searched. |
| Walt | 3 | sometimes | Wants larger, plainly labelled buttons and a sentence such as "Nothing found for deutsche, try a shorter word". |
| Dev | 3 | sometimes | Local and dependency-free, which is good. Wants whole-word and regex options, a "No matches" that says why, and a test for the "deutsche" case. |

## Themes (ordered by how many personas raised them)

1. **"No matches" is a dead end** (Mara, Priya, Theo, Lucía, Sam, Walt, Dev, Dr. Okafor): say that nothing was found, why (capitals, accents, word endings are handled differently) and what to try. Suggest near-misses.
2. **Matching is too narrow** (Jonas, Theo, Lucía, Dev): add accent-insensitive and fuzzy matching, plus whole-word, case-sensitive and optionally regex.
3. **Replace all needs a preview** (Mara, Jonas): show the count and each affected line, flagging unsure words, before changing.
4. **Accessibility and size** (Hana, Walt): labelled, larger prev/next buttons with visible focus; announce the count and "No matches" to screen readers.
5. **Document storage** (Dr. Okafor): state where original and edited text are kept and how they are deleted.

## Recommendations (what the group would have you build)

Ordered by how many personas asked and how cheap the change is. Each item names who wants it.

1. **Make "No matches" explain itself.** Replace the bare text with "Nothing found for “deutsche”", and add a short tip: capitals are ignored, accents and word endings are not matched loosely, try a shorter word. Raised by 8 of 10; the cheapest fix, text only (the strings live in `app/src/i18n/dict/project-view.ts`, so add all four languages).
2. **Offer near-misses when there is nothing.** If the search finds nothing, try again without accents and with the last one or two letters removed, and show "Did you mean: Deutsch (3)". Priya, Theo, Lucía, Walt, Dev.
3. **Accent- and case-insensitive matching.** Normalise both sides (`NFD`, strip combining marks) before comparing, so "Lucia" finds "Lucía" and "uber" finds "über". Lucía, Dev, Jonas.
4. **Preview before Replace all.** Show the count and a scrollable list of the affected lines, with unsure words flagged, and require one more click. Mara, Jonas.
5. **Optional switches: whole word, match case.** Two small toggles next to the box, off by default. Regex only if you want it; only Dev asked. Jonas, Theo, Dev.
6. **Accessibility pass on the bar (mostly already there).** Previous/next are already real buttons with labels and the count sits in a `role="status"` region, so Hana's request was partly met; what is left is the narrow-window case, where `.pv-hits` is hidden. Original ask: Real labelled buttons for previous and next, visible focus, larger hit area, and an `aria-live="polite"` region for the match count and "No matches". Hana, Walt; this is also required by CONTRIBUTING.
7. **Document storage.** One paragraph in `docs/confidentiality.md`: edited and original text are both kept in the project file until the project is removed. Dr. Okafor (check the code first so the statement is true).

**Do first:** 1, 6 and 7 (small, no behaviour risk). **Then:** 2 and 3 together. **Then:** 4, then 5.

**Not recommended:** regex (one vote, adds a way to break the search for a non-technical user: Mara, Walt, Sam would not benefit); fuzzy matching by edit distance (more than 2 and 3 give, and harder to explain).

### Built so far
Recommendations 1, 2, 3, 4, 5 and 7 are in the code and docs: the "Nothing found for …" line with the closest words (click one to search it), accent-insensitive matching in the find box, the highlight and Replace (`app/src/find.ts`), and the storage note in `docs/confidentiality.md`. Checked in the browser mock: "projektee" offers "Projekt (1)", and "fur" finds "für". Also built: 4 (Replace all lists every affected line, flags unsure words, and needs a second click) and 5 (Match case and Whole word switches, in a row under the toolbar so the toolbar stays uncrowded). Checked in the mock: with Match case on, "das" no longer finds "Das" and the hint says why. Not built: regex (not recommended).

### Check against the code
The find box is a plain substring test on lowercased text (`ProjectView.tsx:156-166`, `Transcript.tsx:99`). So "deutsche" *does* match "deutschen" and "deutscher". The screenshot's miss means the text contains "Deutsch" (or a misheard form) but not "deutsche". Several personas guessed at "word endings"; the real gap is that a shorter stem is not tried, which is what recommendation 2 addresses. Accents are not normalised, so recommendation 3 is a real gap.

## Notes

- Nothing was vetoed, and the feature's undo ("Put back what the model heard") was praised by the personas who looked at it.
- The "deutsche" screenshot shows the search failing on visible German word forms; several personas (Lucía, Dev, Jonas) also asked for a test or documented behaviour for it. Check what the code does with word endings and diacritics before deciding.
- Dev under-weights non-technical users and Sam does not edit transcripts, so their votes should count for less here.
