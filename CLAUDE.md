# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

Run with the bun server (required for ES modules and the Notion API proxy):

```
cp .env.example .env        # first time only
# edit .env — add your NOTION_API_KEY
bun server.js
```

Open `http://localhost:8090`. **Do not open `index.html` directly** — ES modules require HTTP, and the Notion sync requires the proxy in `server.js`.

Port 8090, not 8080: glance runs on 8080 under launchd and would collide.

The server proxies `/api/notion/*` → `https://api.notion.com/v1/*` using the key from `.env`. The key never reaches the browser.

## Architecture

ES modules, two JS files and one CSS file. No framework, bundler, or build tool.

| File | Role |
|---|---|
| `js/data.js` | Programme dates, all constants, localStorage persistence, CRUD |
| `js/app.js` | Router, modal, helpers, 5 view renderers, sync engine, boot |
| `js/notion.js` | Notion client + field maps for all five databases |
| `index.html` | 5-nav sidebar, 5 view containers, `<script type="module">` |
| `style.css` | Design system tokens, component styles, subject badge colors |

**`js/data.js`** top-to-bottom:
- Programme dates: `YEAR_START`, `EXAM_DATE`, `YEAR_LABEL`. The countdown and the year progress bar derive entirely from these — check them against the real exam timetable each September.
- Constants: every list mirrors a Notion select or multi-select. Adding a value Notion does not have will silently create a new option on push.
- Persistence: `loadData` / `saveData` over `STORE_KEYS`, gated by `DATA_VERSION`. Bump that string on any schema change to wipe stale localStorage.
- Mutable state: `export let tasks / quests / coding / codingTasks / greek` (live ES module bindings). No seed data — everything is populated from Notion on first sync.
- CRUD per entity, each ending in a `setX(list)` bulk replace used by the sync engine.

**`js/app.js`** top-to-bottom:
- ROUTER: hash-based, `registerView(id, fn)` + `navigateTo(id)` + `activateView(id)`. Nav items and view containers both use `data-view`; the router selects containers with `main [data-view]` to avoid collision. An unknown hash falls back to the default view rather than rendering blank.
- MODAL: single shared overlay. `openModal({ title, fields, onSubmit })`. Field types: `text`, `date`, `url`, `textarea`, `select`, `multi` (chip picker for Notion multi-selects), `checkbox`. `collectFields` reads the form explicitly because `Object.fromEntries` collapses the repeated names a chip picker produces.
- HELPERS: `esc()`, `fmtStatus()`, `fmtDate()`, `daysUntil()`, `chips()`, `dueChip()`, `subjectBadge()`, `armDelete()`, `getISOWeek()`.
- DASHBOARD: deadline ticker (assignments + dev tasks), stat row, urgent list, subject load bars, exam countdown.
- ASSIGNMENTS: table/board toggle, filters, sort, drag-and-drop, click-to-cycle status and priority.
- CODING: two tabs over two databases — projects (cards) and tasks (table/board).
- GREEK PORTFOLIO: one card per portfolio entry, status stepper, chip rows per multi-select, ManageBac toggle.
- SIDE QUESTS: one card per logged quest, status cycle, filters by status / category / year.
- NOTION SYNC: `SYNC_VIEWS` config table + one generic `syncView()`. Assignments have their own pull because they also carry a page body and a done-task cutoff.
- BOOT: coding projects sync before coding tasks so the task→project relation can resolve to a name.

## Notion Databases

Five databases, all two-way. IDs live at the top of `js/notion.js`.

| View | Database | Notes |
|---|---|---|
| Assignments | Assignments | `Overdue` is a read-only formula. `ManageBac` is filled by the siren watcher — read only here. |
| Coding (projects) | Coding Projects | `Last Pushed`, `GitHub Repo ID`, `README synced` are written by the GitHub Actions sync — read only here. |
| Coding (tasks) | Coding Tasks | `Project` is a relation to Coding Projects. `On Board` is a read-only formula. Empty relation is intentional for learning goals. |
| Greek Portfolio | Modern Greek Portfolio | One row per portfolio *entry*, not per set text. Seven multi-selects. |
| Side Quests | Side Quests | A record of things that happened, not a task list. `Business Venture` and the CAS / Project relations are curated in Notion — read only here. |

**Never write a read-only property.** Formulas, rollups, and anything filled by an external sync will 400 or clobber.

## Data Model

localStorage, one key per entity:

- `ib_tasks` → `{ id, notionId, title, subject, deadline, priority, status, type, notes, managebacUrl, body, createdAt, updatedAt, notionUpdatedAt }`
- `ib_quests` → `{ id, notionId, name, status, date, role, schoolYear, category: [], notes, outcome, link, businessVenture: [], notionUpdatedAt }`
- `ib_coding` → `{ id, notionId, name, status, category, stack: [], type, description, repoUrl, started, lastPushed, notionUpdatedAt }`
- `ib_coding_tasks` → `{ id, notionId, title, status, priority, deadline, notes, projectNotionId, createdAt, updatedAt, notionUpdatedAt }`
- `ib_greek` → `{ id, notionId, title, status, date, onManageBac, texts: [], concepts: [], areas: [], assessment: [], fields: [], readingLog: [], skills: [], notionUpdatedAt }`

Enum values (UI side; `js/notion.js` maps each to its Notion wording):
- `status`: `TODO | IN_PROGRESS | BLOCKED | DONE` — assignments and coding tasks share one vocabulary. Greek uses the same three-of-four minus `BLOCKED`, and renders `TODO` as "Not Started" to match Notion.
- `priority`: `HIGH | NORMAL | LOW` → `🔥 High | ⚡ Medium | 🧊 Low`
- `status` (coding projects): `IDEA | IN_PROGRESS | PAUSED | SHIPPED | ARCHIVED`
- `status` (side quests): `ONGOING | DONE | DROPPED`

## Sync Model

Last write wins, compared on `notionUpdatedAt`. Local edits queue on a 2s debounce (`schedulePush`) and flush to Notion; a manual sync flushes pending pushes *before* pulling, otherwise a sync fired inside the debounce window would overwrite an unsent edit.

A first sync on an empty store is effectively read-only: nothing local exists to push.

## Design System

Industrial brutalist "mission control": hard edges (no border radius), hard offset
shadows, stencil display type, lime signal color on near-black layered surfaces.
Webfonts from Google Fonts in `index.html` (Archivo Black / Space Grotesk /
JetBrains Mono) with local fallbacks (Impact / Helvetica / monospace).

Key tokens in `style.css`:

```
--accent: #E8FF47          (lime yellow — primary CTA, active nav, section underlines)
--bg-0 … --bg-3            (surface ladder: sidebar → canvas → panels → raised cards/inputs)
--line-1 … --line-3        (border ladder)
--ink-1 … --ink-3          (text ladder: primary → secondary → muted)
--status-blocked: #FF4747
--status-in-progress: var(--accent)
--status-done: #47FF8A
--shadow-hard / --shadow-hard-sm   (offset box shadows on panels/cards/buttons)
--hazard                   (diagonal red striping — overdue rows, blocked cards)
--font-display: Archivo Black / Impact   (headers, brand, stat numbers, big metrics)
--font-mono: JetBrains Mono              (labels, chips, badges, buttons)
```

CSS class conventions:
- `.s-{STATUS}` — status chip color; `.status-badge` renders a bordered chip tinted via `currentColor`
- `.p-{PRIORITY}` / `.p-dot-{PRIORITY}` — priority label with leading square dot / 8px circle dot
- `.s-border-{STATUS}` — board card left-border color
- `.seg-border-{STATUS}` — Greek entry card top-border color
- `.subject-badge.subj-{slug}` — subject chip with background color
- `.chip-picker` / `.chip-option` / `.chip-on` — how every Notion multi-select is edited
- `.mono-label` — 10px uppercase mono tracking label
- `.display-text` — display font, uppercase, tight line-height
- `.data-section` — panel: raised surface + border + hard shadow
- `.action-btn` (+ `.ghost`, `.sm`) — accent outline button / muted / compact
- `.due-chip` (+ `.chip-danger`, `.chip-link`) — mono date/days chip
- `.overdue-row` — hazard striping + red left border on task rows
- `.ticker-wrap` / `.ticker` — dashboard deadline marquee

HTML pattern: each view is a `<div data-view="viewname">` inside `<main>`. The router shows/hides them with `main [data-view]`.
