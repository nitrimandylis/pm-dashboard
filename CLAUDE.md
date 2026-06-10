# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

Run with the bun server (required for ES modules and Notion API proxy):

```
cp .env.example .env        # first time only
# edit .env — add your NOTION_API_KEY
bun server.js
```

Open `http://localhost:8080`. **Do not open `index.html` directly** — ES modules require HTTP, and the Notion sync requires the proxy in `server.js`.

The server proxies `/api/notion/*` → `https://api.notion.com/v1/*` using the key from `.env`. The key never reaches the browser.

## Architecture

The app uses ES modules with two JS files and one CSS file. No framework, bundler, or build tool.

| File | Role |
|---|---|
| `js/data.js` | All constants, seed data, localStorage persistence, and CRUD functions |
| `js/app.js` | Imports from data.js. Router, modal, helpers, all 5 view renderers, boot |
| `index.html` | 5-nav sidebar, 5 view containers, `<script type="module">` |
| `style.css` | Design system tokens, all component styles, subject badge colors |

**`js/data.js`** top-to-bottom sections:
- Constants: `SUBJECTS`, `STATUS`, `PRIORITY`, `SIDE_QUEST_STATUSES`, `GREEK_TEXT_STATUSES`
- Seed data: `SEED_TASKS` (14), `SEED_PROJECTS` (4), `SEED_EE`, `SEED_GREEK`
- Persistence: `loadData(key, seed)` / `saveData(key, value)` using `STORE_KEYS`
- Mutable state: `export let tasks / projects / ee / greek` (live ES module bindings)
- CRUD: `createTask`, `updateTask`, `deleteTask`, `createProject`, `updateProject`, `deleteProject`, `updateEE`, `addMeeting`, `updateGreek`, `updateGreekText`

**`js/app.js`** top-to-bottom sections:
- IMPORTS: all from `./data.js`
- ROUTER: hash-based, `registerView(id, fn)` + `navigateTo(id)` + `activateView(id)`. Nav items use `data-view`. View containers in `<main>` also use `data-view`; router selects them with `main [data-view]` to avoid collision.
- MODAL: single shared overlay (`#modal-overlay` / `#modal-box`). `openModal({ title, fields, onSubmit })`
- HELPERS: `esc()`, `fmtStatus()`, `fmtDate()`, `daysUntil()`, `subjectSlug()`, `subjectBadge()`, `getISOWeek()`, `updateMeta()`
- DASHBOARD: `renderDashboard()` — deadline ticker, stat row, urgent list, subject load bars, exam countdown + year progress
- ASSIGNMENTS: `initAssignments()` (injects toolbar into container), `renderAssignments()`, table/board toggle, task CRUD modals
- EE TRACKER: `renderEETracker()` — percent display + word count, milestone timeline checkboxes, supervisor meeting log
- GREEK PORTFOLIO: `renderGreekPortfolio()` — global issue, progress segments, text cards with status stepper / word count / notes
- DEV PM: `renderPM()` — projects / tickets / team tabs with CRUD
- BOOT: `initModal()`, `initAssignments()`, `registerView()` calls, nav listeners, meta-grid init, `initRouter('dashboard')`

## Data Model

All data stored in localStorage as JSON:

- `ib_tasks` → `{ id, title, subject, deadline, priority, status, notes, createdAt, updatedAt }`
- `ib_projects` → `{ id, name, status, lastAction, nextStep, priority }`
- `ib_ee` → `{ wordCount, milestones: [{ id, label, done }], meetings: [{ id, date, notes }] }`
- `ib_greek` → `{ globalIssue, texts: [{ id, title, wordCount, status, notes }] }`

Enum values:
- `subject`: MATH HL | ENGLISH HL | GREEK B HL | HISTORY HL | BIOLOGY SL | FILM SL | TOK
- `priority`: CRITICAL | HIGH | NORMAL | LOW
- `status` (tasks): TODO | IN_PROGRESS | REVIEW | DONE | BLOCKED
- `status` (projects): ACTIVE | PAUSED | DONE
- `status` (greek texts): DRAFT | REVISED | FINAL

## Design System

Industrial brutalist "mission control": hard edges (no border radius), hard offset
shadows, stencil display type, lime signal color on near-black layered surfaces.
Webfonts loaded from Google Fonts in `index.html` (Archivo Black / Space Grotesk /
JetBrains Mono) with local fallbacks (Impact / Helvetica / monospace).

Defined in `style.css` CSS variables. Key tokens:

```
--accent: #E8FF47          (lime yellow — primary CTA, active nav, section underlines)
--bg-0 … --bg-3            (surface ladder: sidebar → canvas → panels → raised cards/inputs)
--line-1 … --line-3        (border ladder)
--ink-1 … --ink-3          (text ladder: primary → secondary → muted)
--status-blocked: #FF4747
--status-in-progress: var(--accent)
--status-review: #47C3FF
--status-done: #47FF8A
--shadow-hard / --shadow-hard-sm   (offset box shadows on panels/cards/buttons)
--hazard                   (diagonal red striping — overdue rows, blocked cards)
--font-display: Archivo Black / Impact   (headers, brand, stat numbers, big metrics)
--font-mono: JetBrains Mono              (labels, chips, badges, buttons)
```

CSS class conventions:
- `.s-{STATUS}` — status chip color (e.g. `.s-BLOCKED`); `.status-badge` renders a bordered chip tinted via `currentColor`
- `.s-greek-{STATUS}` — Greek text status chip colors (DRAFT/REVISED/FINAL)
- `.p-{PRIORITY}` — priority label with leading square dot (`::before`)
- `.p-dot-{PRIORITY}` — priority circle dot (8px)
- `.s-border-{STATUS}` — board card left-border color
- `.subject-badge.subj-{slug}` — subject chip with background color
- `.mono-label` — 10px uppercase mono tracking label
- `.display-text` — display font, uppercase, tight line-height
- `.data-section` — panel: raised surface + border + hard shadow (all views)
- `.section-header` / `.panel-header` — accent-underlined display header / small mono header
- `.action-btn` (+ `.ghost`, `.sm`) — accent outline button / muted variant / compact variant
- `.due-chip` (+ `.chip-danger`) — mono date/days chip; danger turns it red
- `.overdue-row` — hazard striping + red left border on task rows
- `.board-5col` — overrides board grid to 5 columns (used in assignments board)
- `.ticker-wrap` / `.ticker` — dashboard deadline marquee (duplicated `.ticker-group`s, CSS keyframe scroll)
- `.ee-*` — EE tracker (percent display, progress track, milestone timeline, meeting log)
- `.greek-*` — Greek portfolio (text cards, status stepper, progress segments)

HTML pattern: each view is a `<div data-view="viewname">` inside `<main>`. The router shows/hides them with `main [data-view]` selector. Nav items use `data-view` attribute for the same view IDs.
