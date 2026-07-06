# extra

Agentic inbox triage. **Pick it → it gets drafted → you send it.**

`extra` is the front end for the morning-brief system: Claude routines scan
Outlook + Granola every weekday, push the real work into Todoist, and mark
what's draftable. This app turns that state into a one-screen triage queue —
tap **Draft it** on anything, and within the hour the draft is waiting for you
(and, with Graph configured, sitting in your actual Outlook Drafts folder).

Nothing is ever sent automatically. You are the only one who hits send.

## How it fits together

```
Outlook + Granola ──► morning-brief routine (weekdays 7am ET)
                              │  pushes tasks, marks `draftable`,
                              │  drafts thought-leadership posts
                              ▼
                          Todoist  ◄─── the database (tasks/labels/comments)
                              ▲
        extra (this app) ─────┤  you tap "Draft it" → sets `draft-me`
                              │
                      draft-worker routine (hourly)
                              │  writes the draft as a task comment,
                              ▼  flips label to `draft-ready`
        extra shows it under "Ready to send" →
        copy it, or push it into Outlook Drafts via Microsoft Graph
```

The routine prompts live in the `blender_mcp` repo under `routines/` — that
README documents the full label state machine (`draftable`, `draft-me`,
`draft-ready`, `draft-failed`, `nudge-drafted`, `thought-leadership`, …).

## Screens (v0)

- **Ready to send** — drafts written for the items you picked: copy the body,
  push to Outlook Drafts (if Graph is configured), redraft, open the source
  email, or mark done
- **Pick what to draft** — everything the morning brief marked `draftable`,
  one tap to queue
- **Drafting** — queued items the hourly worker will pick up
- **Needs your input** — drafting failed; the card shows why
- **Post ideas** — thought-leadership drafts, ready to copy to LinkedIn
- **Possibly handled** — items the routine thinks you already dealt with

## Setup

### macOS — one command

```bash
curl -fsSL https://raw.githubusercontent.com/wmatt0482/extra/claude/extra-v0/scripts/install-mac.sh | bash
```

Checks/installs Node, clones to `~/extra`, prompts once for your Todoist
token, builds, installs a launchd service (starts at login, auto-restarts),
and opens http://localhost:3000. Re-running updates in place. Uninstall
instructions are at the top of `scripts/install-mac.sh`.

### Manual

```bash
npm install
cp .env.example .env.local   # add your TODOIST_API_TOKEN
npm run dev                  # http://localhost:3000
```

`TODOIST_API_TOKEN`: Todoist → Settings → Integrations → Developer → API token.

Optional — to enable the **To Outlook Drafts** button, configure Microsoft
Graph per [`docs/GRAPH_SETUP.md`](docs/GRAPH_SETUP.md).

## Deploying

Any Node host works; Vercel is the easy path (`vercel deploy`, set the env
vars in the project settings). The app has **no auth of its own** — it fronts
your personal inbox, so put it behind Vercel's deployment protection (or run
it locally / on a Tailscale node) rather than leaving it on a public URL.

## Roadmap

- [x] Inline draft editing before copy / push to Drafts — edits are saved as
      ✏️ comments in Todoist, so the draft-worker routine can study your
      original-vs-edited pairs and calibrate its voice over time
- [x] Metrics (`/metrics`): live pipeline tiles, waiting-ons by counterparty
      with aging flags, closed-per-week throughput, drafts edited-before-send
- [x] Snooze (1 day / 1 week) from the triage screen — hides the card until
      the date arrives and surfaces it in Todoist's Today view
- [ ] One-tap LinkedIn publish for post ideas
