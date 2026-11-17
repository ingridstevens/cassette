# Personas

Ten made-up users of Cassette. Each one is written so an AI agent can play them: the file is that agent's
instructions. They do two jobs:

- **Vote** on proposed features, each from their own point of view (`/persona-vote`, see [Votes](../votes/README.md)).
- **Test** the app by following a first-run script and reporting where they got stuck (see [Testing](../testing.md)).

| Persona | Who | Cares most about | Veto trigger |
| --- | --- | --- | --- |
| [Mara](mara.md) | Freelance journalist | Accurate quotes, nothing uploaded | Data leaves the computer; hides unsure words |
| [Jonas](jonas.md) | PhD researcher | Anonymised, reproducible bulk exports | Telemetry; lossy or unstable exports |
| [Priya](priya.md) | Operations lead | Meeting minutes fast | Summary that cannot be edited or discarded |
| [Theo](theo.md) | Podcaster and editor | Speed, chapters, subtitles, clips | Noticeably slower with no opt-out |
| [Lucía](lucia.md) | Interpreter and translator | Mixed languages, translation, localised UI | Broken de/fr/es interface |
| [Sam](sam.md) | Setup person | Installable, importable models, clear errors | Breaks models import; needs an account |
| [Hana](hana.md) | Keyboard and screen-reader user | Full keyboard access, contrast, labels | Any keyboard or screen-reader regression |
| [Dr. Okafor](okafor.md) | Confidentiality-bound professional | Offline guarantee, retention, no leaks | Any network call, telemetry or text in logs |
| [Walt](walt.md) | Oral historian (70s), older Mac | Reliability, readability, light models | Too heavy for an Intel Mac; can lose work |
| [Dev](dev.md) | Sceptical open-source developer | Verifiable claims, small footprint | Undisclosed network; unclear licence |

## What these are, and are not

They are **simulated opinions**. They are good at surfacing trade-offs, catching regressions in a user's view of the
app, and making you consider people you would otherwise forget. They are **not evidence of demand**: an AI
persona agreeing a feature is useful tells you nothing about how many real people want it. Check important
decisions against real users and issue reactions.

Each persona also lists its **blind spots**. A veto from a persona is a prompt to look at the feature, not an
automatic "no".

## Adding or changing a persona

Copy an existing file. Keep the same headings: *Who*, *What they want*, *Voice*, *Rewards*, *Penalises*, *Vetoes*,
*First-run test script*, *Blind spots*. The voting skill reads the whole file, so concrete rewards, penalties and vetoes
make the votes more consistent. Add the persona to the table above. If you add or remove one, nothing else needs
to change; the skill reads every `*.md` file here except this one.
