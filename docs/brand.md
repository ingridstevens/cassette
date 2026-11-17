# Cassette brand guide

How Cassette looks and sounds. Use it when you draw a screen, write a string, make a poster or add a page to the docs.
The colours here are the real ones: they live in `app/src/styles/themes.css` and `app/src/types.ts`, and
`npm run contrast:check` in `app/` tests them.

## Name

The app is called **Cassette**. One word, capital C, no "the", no "Cassette app" in running text.
Say "Cassette turns recordings into text", not "the Cassette transcriber tool". Never write CASSETTE or cassette in the middle of a sentence.

## Icon and logo

The icon is a flat, white cassette on a petrol tile: a label strip on top and two round reel holes below. It has no gradient, no glow and no shadow.
The word "Cassette" is set in Inter SemiBold next to it. In the app the sidebar shows a small version of the same drawing.

| File | Use |
| --- | --- |
| `app/resources/icon-src/cassette.svg` | The master drawing, 64 px and up. It has the margin macOS expects around the tile. |
| `app/resources/icon-src/cassette-small.svg` | The simpler drawing for 16, 24 and 32 px. The tile fills the whole square and the label is bolder. |
| `app/resources/icon.svg`, `.png`, `.icns`, `.ico` | Exported files used by the app and the installers. See *App icon* in [Development](development.md). |

**Clear space.** Keep free space around the icon equal to the width of one reel hole (about one fifth of the icon). No text or edge inside it.

**Minimum sizes.** Icon alone: 16 px on screen, 10 mm in print. Icon with the word: 96 px wide on screen. Below 48 px always use the small drawing.

**Backgrounds.** The tile is petrol on every background, light or dark. Do not put the icon on a busy photo. If you must, use the white clear space.

## Colour

One brand colour, **petrol**: a deep blue-green. It is the only accent in the interface, so anything petrol means
"you can act here" or "this is the current thing".

| Name | Hex | Where | Contrast |
| --- | --- | --- | --- |
| Petrol | `#0a6577` | Accent in light mode: links, focus ring, playhead, speaker 1, the icon tile | 6.7:1 on white, 6.3:1 on the page grey |
| Petrol deep | `#064453` | Pressed state, print on white where you need more weight | 10.7:1 on white |
| Petrol light | `#4cc2d4` | Accent in dark mode: links, playhead, speaker 1 | 8.5:1 on the dark card, 9.0:1 on the dark page |
| Petrol light, text | `#7fd6e8` | Links and focus ring in dark mode | 10.8:1 on the dark card |
| Petrol button, dark | `#0e7d97` | Filled button in dark mode, with white text | 4.8:1 |
| Label tint | `#bfe3ea` | The label strip of the icon | 4.9:1 against petrol |

White on petrol is 6.7:1, which passes AA for all text sizes. The primary button in light mode is near-black (`#0b0b0f`), not petrol, so petrol stays rare.

### Supporting colours

| Role | Light | Dark | Meaning |
| --- | --- | --- | --- |
| Amber | `#c2410c` (5.2:1 on white) | `#f0a45e` (8.7:1 on dark card) | **Unsure words** and warnings. Never use it for anything else, so people learn it. |
| Green | `#15803d` | `#34d399` | Done, saved, offline |
| Red | `#b91c1c` | `#ff7a9c` | Errors and deleting |
| Ink and greys | `#0b0b0f`, `#444a55`, `#626a77` | `#f2f5f7`, `#b4bec7`, `#94a0ab` | Text, second-level text, hints. All 4.5:1 or more on the page. |
| Page and card | `#f7f9fa`, `#ffffff` | `#0c1115`, `#12181d` | Background and cards |

Speaker colours are eight fixed colours per mode, with petrol first (see `PALETTES` in `types.ts`). Never colour a speaker black, white or amber.
Colour is never the only signal: unsure words also have an underline, speakers also have a name.

## Typography

- **Inter** for everything in Latin, Greek and Cyrillic script. Weights: Regular 400, Medium 500, SemiBold 600, Bold 700. Bundled with the app, so it works offline.
- **Vazirmatn** takes over for Arabic script (Arabic, Persian, Dari, Pashto, Urdu). It is picked automatically as the second font in the stack.
- Fallback: the system font (`-apple-system`, Segoe UI).
- Transcripts use the same font as the interface. Numbers in timestamps use tabular figures.

| Role | Size | Weight |
| --- | --- | --- |
| Page title | 20–22 px | 650 |
| Section title | 17 px | 650 |
| Names, field values | 15 px | 650 |
| Body, buttons, menus | 14 px (buttons 13) | 400–600 |
| Hints, times, chips | 12–12.5 px | 500 |

Never go below 12 px. Transcript text is 16 px. Line height is 1.45 for interface text, 1.6 for transcript lines and 1.95 for right-to-left transcript lines. The user can scale all text to 115, 130 or 150 percent in Settings; layouts must survive 150.
The code still has a few in-between sizes (13.5 px, 11.5 px). Treat the table above as the target when you touch a rule.

Shape: pills (fully round) for buttons and chips, 10 px for inputs and menu items, 16 px for cards. Spacing in steps of 4 px.

## Icon family

Interface icons are 24 px outline icons: 2 px stroke (1.5 px at 40 px and up), round ends and joins, no fills, `currentColor`.
They sit on a 24 px grid with 2 px padding. Use one metaphor per action everywhere (a plus adds, a circle records) and always give an icon a text label or an accessible name.
The app icon is the only filled drawing.

## Tone of voice

Cassette is used by people who may be tired, stressed, new to the country or working in their third language. Write for them.

- **Plain language.** Short words. Say "Save", not "Persist". Say what happens, then what to do.
- **English: at most 12 words per sentence.** One idea per sentence. Active voice. Say "you".
- **German: Leichte Sprache.** One sentence, one statement. Short words, no genitive, no passive, no metaphors. Join long compound words with a hyphen (Text-Größe). Same word for the same thing every time.
- **French and Spanish:** the same rules as English: short, direct, "you" form.
- No jokes in errors. Say what went wrong and how to fix it. No blame ("You entered…"), no "Oops".
- Call things what people call them: *recording*, *transcript*, *speaker*, *unsure word*. See the [glossary](glossary.md).

`npm run i18n:check` makes sure every string has its translations.

## Do and don't

| Do | Don't |
| --- | --- |
| Use petrol for the one thing to act on | Use petrol for decoration or on three things in a row |
| Keep amber only for unsure words and warnings | Use amber as a second brand colour |
| Use the small icon drawing under 48 px | Scale the large icon down to 16 px |
| Keep shapes flat | Add glows, gradients or drop shadows to the icon |
| Put a text label next to every icon | Rely on colour alone |
| Write one idea per sentence | Write long sentences with "which" and "although" |
| Stretch nothing: keep the icon's proportions | Rotate, recolour, outline or add effects to the icon |

## Right-to-left

Arabic, Persian, Hebrew and Urdu text runs right to left. Today the **transcript** handles this: text blocks use `dir="auto"`, so each line follows its own language, and right-to-left lines get a taller line height for Vazirmatn.
The **interface** is not mirrored yet, because the app is not offered in an RTL language. These rules apply when it is:
sidebar on the right, back arrows point right, progress bars fill from the right. Do **not** mirror the cassette icon, the waveform (time runs left to right in audio), play and pause, or numbers.
Write new CSS with logical properties (`margin-inline-start`, not `margin-left`).

## Motion

The one piece of motion is the logo: the two reels turn slowly (one turn in 2.4 seconds) while a transcript is being written, and stop when it is done.
Everything else is quick (150 ms or less) and only fades or moves a short distance. No bouncing, no looping decoration.
When the system asks for reduced motion, the reels stay still and nothing else moves; the state is still shown with text ("Writing…").
