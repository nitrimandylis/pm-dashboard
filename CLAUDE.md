# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

Serve with a local HTTP server — ES modules require HTTP, not `file://`:

```
bunx serve . -p 8080
```

Then open `http://localhost:8080` in a browser. **Do not open `index.html` directly** — ES module imports are blocked on `file://` URLs by browser CORS policy.

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
- DASHBOARD: `renderDashboard()` — stat row, urgent list, subject load bars, exam countdown
- ASSIGNMENTS: `initAssignments()` (injects toolbar into container), `renderAssignments()`, table/board toggle, task CRUD modals
- EE TRACKER: `renderEETracker()` — word count + progress bar, milestone checkboxes, meeting log
- SIDE QUESTS: `renderSideQuests()` — project table with CRUD
- GREEK PORTFOLIO: `renderGreekPortfolio()` — global issue, 4 text rows (expandable), progress bar
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

Defined in `style.css` CSS variables. Key tokens:

```
--accent: #E8FF47          (lime yellow — primary CTA, active nav, section underlines)
--status-blocked: #FF4747
--status-in-progress: var(--accent)
--status-review: #47C3FF
--status-done: #47FF8A
--font-display: Impact      (section headers, brand, stat numbers)
```

CSS class conventions:
- `.s-{STATUS}` — status text color (e.g. `.s-BLOCKED`, `.s-IN_PROGRESS`)
- `.p-{PRIORITY}` — priority text color (e.g. `.p-CRITICAL`)
- `.p-dot-{PRIORITY}` — priority circle dot (8px)
- `.s-border-{STATUS}` — board card left-border color
- `.subject-badge.subj-{slug}` — subject chip with background color
- `.mono-label` — 11px uppercase tracking label
- `.display-text` — Impact font, uppercase, tight line-height
- `.board-5col` — overrides board grid to 5 columns (used in assignments board)

HTML pattern: each view is a `<div data-view="viewname">` inside `<main>`. The router shows/hides them with `main [data-view]` selector. Nav items use `data-view` attribute for the same view IDs.
