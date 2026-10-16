# Two looks: Fairytale sunset or Series A (colour-only mockup)

> Simulated votes by ten AI personas. They are not evidence of demand. Proposals: [two-looks-sunset-vs-series-a](proposals/2026-10-16-two-looks-sunset-vs-series-a.md). Mockup: [two-looks.html](../mockups/two-looks.html) and the four screenshots in `../mockups/`. Both looks use the same layout and components; only colour differs.

## Vetoes

None.

## Ranking

| Feature | Mean | Spread |
| --- | --- | --- |
| F2 Series A palette (placeholder name) | 3.9 | 1 |
| F3 Only two looks, no slider | 3.7 | 1 |
| F1 Fairytale sunset (kept) | 3.0 | 0 |

**Preferred look: Series A, 10 of 10** (most of them the light version; Theo prefers the dark one).

## Contested

Nothing has a spread of 3 or more. The one split is the dark-mode accent: Theo wants the lime ("exactly that"), while Jonas, Walt, Priya, Dev, Okafor, Sam, Lucía, Hana and Mara call it loud or tiring.

## Per-persona scores (F1 / F2 / F3)

| Persona | F1 sunset | F2 Series A | F3 two looks |
| --- | --- | --- | --- |
| Mara | 3 | 4 | 4 |
| Jonas | 3 | 4 | 4 |
| Priya | 3 | 4 | 4 |
| Theo | 3 | 4 | 3 |
| Lucía | 3 | 3 | 3 |
| Sam | 3 | 4 | 4 |
| Hana | 3 | 4 | 4 |
| Okafor | 3 | 4 | 3 |
| Walt | 3 | 4 | 4 |
| Dev | 3 | 4 | 4 |

## Recommendations

Ordered by how many personas asked and how cheap the change is.

1. **Soften the dark-mode accent** (Jonas, Walt, Priya, Dev, Okafor, Sam, Lucía, Hana, Mara; Theo disagrees). Replace acid lime with a calmer colour (muted blue, or a dimmer green), and do not use one accent for the button, the current speaker and the waveform at once (Dev). Cheap: one CSS token. **Do first.**
2. **Make speakers distinguishable by more than hue** (all ten in some form). Series A light has black and indigo, and Ben's black dot looks like the button or plain text (Theo, Priya, Sam, Mara, Walt); dark has white and lime. Pick distinct, non-black, non-white speaker colours, and add an initial or shape beside the name for colour-blind users and print (Jonas, Priya, Hana, Dev). Lucía asks for a separate colour for language tags. Cheap for colours, moderate for shapes.
3. **Darken and enlarge the small grey text** and the pale waveform in both looks: timestamps, "N turns", the hint line, unplayed waveform bars (Walt, Hana, Sam, Dev, Theo, Mara, Okafor). Add a contrast test on the colour tokens for all four combinations (Dev, Sam, Hana ask for it, Hana wants 7:1). Cheap.
4. **Rename Series A** to a plain word (Mara, Walt, Priya, Sam, Hana, Dev, Okafor, Lucía, Theo, Jonas all dislike it). Suggestions: **Clean** (6), **Plain** (5), **Studio** (5), Focus, Professional. Lucía needs the name translated into de/fr/es. Pick one and add it to all four i18n dicts.
5. **Settings tiles must be accessible** (Hana, Lucía, Sam): real labelled radio buttons with arrow-key selection, a visible focus ring in both looks, and "Match my computer" should also follow the system high-contrast setting. Show the unsure-word underline the same in both previews (Mara).
6. **Migration and privacy note** (Jonas, Dev, Okafor): old saved `lookLevel` values (0–3) and the legacy `boring` flag must map cleanly; a changed look must never alter exports; Settings may say that the look is a local preference only. Sam: do not touch first-run or models import.

**Would not do:** keep the metrics strip or monospace labels from the first mockup (the user said all elements stay identical), or use lime on a white page. Do not treat "Series A wins 10 of 10" as demand: every persona is the same model, none was shown a real alternative, and Sunset got a flat 3 from everyone, which suggests they read "Sunset" as the fallback. Do not remove Sunset on this evidence alone.

### Check against the code

- Personas worry about more than three speakers. The app already has an eight-colour speaker palette per look (`PALETTE` in `app/src/types.ts`); the mockup only shows three, so recommendation 2 is about making those eight distinct, not adding more.
- The saved look is `lookLevel` 0–3 plus a legacy `boring` flag, read by `lookLevelOf`, so a migration is a small mapping: 0 and 1 to sunset, 2 and 3 to Series A (a decision for the owner).
- The existing dark mode already hardcodes a violet focus ring and has no `prefers-contrast` or `forced-colors` rules, so Hana's high-contrast request is new work.
- The floating switcher that several personas say overlaps the hint line exists only in the mockup HTML; it is not an app control.
- Jonas, Dev and Okafor's fear of a network call or new font is unfounded for this change, since the app already uses only system fonts and CSS tokens.

## Notes

- Blind spots: Dev and Jonas over-weight contrast tests and migration; Walt and Hana weight text size, which Series A already helps; Theo's dark preference is the only dissent and he scored speed work above any look.
- The mockup shows one screen. Nobody could judge focus rings, the Settings tiles, the review mode or the share card.
- Only Lucía scored Series A below 4 (3), because of speaker separation and the untranslatable name; Theo and Okafor scored F3 at 3 as "tidy, not valuable".
- Jonas's first reply omitted the feedback field and was re-asked once; the answer is included above.

## Update after the vote

The owner chose the name **Clean** for Series A, added a **High contrast** option to both looks (each with light and dark), and replaced the dark-mode lime with burgundy / magenta (recommendation 1). Screenshots in `docs/mockups/` now show all eight combinations (`*-hc.png` is high contrast). The personas have not seen this version.
