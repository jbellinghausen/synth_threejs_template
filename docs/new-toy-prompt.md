# Prompt: add a new toy to this project

Fill in the parts in [brackets], then paste everything below the line into a
new agent session started in this project. The agent adds the toy alongside
the existing ones; the picker in the panel switches between them.

---

Add a new musical toy to this project. Read `AGENTS.md` first and follow it:
it has the hardware facts, the rules, the workflow and how to verify your
work. Make the toy in its own folder under `src/toys/`, register it in
`src/toys/index.js`, and leave the other toys as they are.

**The idea**: [one or two paragraphs: the mood, the genre or references, what
should happen over time. For example: "slow interlocking arpeggios over a soft
kick, like Emeralds, with LFO crossfades between two arps"]

**The visual**: [what it should look like and how it should react to the
music. For example: "a gamelan-style mandala of rotating rings, one per voice,
with notes spiralling outward"]

**Name**: [TOY NAME] (the picker label; use a lowercase version as the `id`
and folder name)

**My patching**: [list what's plugged into each jack you want used, by the
jack numbers printed on the panel (1–12), or say "keep it compatible with the
existing patch" and the agent will use the layout in AGENTS.md section 1]

**Anything else**: [tempo range, sections, extra toggle buttons, things to
avoid]

When you're done:
- report the results of `npm test`, `npm run report -- --toy <id>` and
  `npm run build`;
- say whether you did the browser check at `?toy=<id>`;
- list what you couldn't verify.
Don't connect to the Pi (`raspberrypi.local`) unless I ask. Use the dry-run
daemon described in AGENTS.md.
