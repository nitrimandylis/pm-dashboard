# IB Dashboard 2025-26

Personal mission-control dashboard for the IB Diploma Programme. Industrial-brutalist UI, vanilla ES modules (no framework, no build step), two-way synced with Notion.

## Views

| View | What it does |
|---|---|
| **Dashboard** | Deadline ticker, stat cards, urgent task list, subject load, exam countdown |
| **Assignments** | Task table/kanban with filters, sorting, drag-and-drop — synced with Notion Assignments DB |
| **Coding** | Coding project cards (status, stack, repo links) — synced with Notion Coding Projects DB |
| **Greek Portfolio** | Language B oral portfolio: global issue, text status stepper |
| **Side Quests** | Projects / tickets / team boards — synced with Notion Side Quests DB |

## Running

Requires [Bun](https://bun.sh).

```sh
cp .env.example .env   # add your NOTION_API_KEY
bun server.js
```

Open <http://localhost:8080>. Do **not** open `index.html` directly — ES modules need HTTP, and Notion sync needs the server proxy.

The server serves static files and proxies `/api/notion/*` → `https://api.notion.com/v1/*`, keeping the API key server-side.

## Architecture

- `index.html` — sidebar nav + view containers
- `js/app.js` — hash router, modal, view renderers, Notion sync orchestration
- `js/data.js` — constants, localStorage persistence, CRUD
- `js/notion.js` — Notion API client + field mapping
- `style.css` — design-system tokens and all component styles
- `server.js` — Bun static server + Notion proxy

Data lives in localStorage and syncs with Notion (last-write-wins). See `CLAUDE.md` for the full data model and design-system reference.
