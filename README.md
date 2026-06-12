<div align="center">

```
 ██╗██████╗     ██╗██████╗  ██████╗
 ██║██╔══██╗   ██╔╝╚════██╗██╔════╝
 ██║██████╔╝  ██╔╝  █████╔╝███████╗
 ██║██╔══██╗ ██╔╝  ██╔═══╝ ██╔═══██╗
 ██║██████╔╝██╔╝   ███████╗╚██████╔╝
 ╚═╝╚═════╝ ╚═╝    ╚══════╝ ╚═════╝
```

### `DIPLOMA PROGRAMME // MISSION CONTROL`

_a project management dashboard for the hardest two-year sprint of my life_

![frameworks](https://img.shields.io/badge/frameworks-0-E8FF47?style=flat-square&labelColor=111111)
![build step](https://img.shields.io/badge/build_step-none._we_ship_raw-E8FF47?style=flat-square&labelColor=111111)
![border radius](<https://img.shields.io/badge/border--radius-0px_(non--negotiable)-E8FF47?style=flat-square&labelColor=111111>)
![deadline](https://img.shields.io/badge/motivation-fear_of_deadlines-FF4747?style=flat-square&labelColor=111111)
![sync](https://img.shields.io/badge/source_of_truth-notion-47C3FF?style=flat-square&labelColor=111111)

</div>

---

## 🛰️ What is this

Most students have a planner. I have **mission control**: an industrial-brutalist
ops console for the IB Diploma. Hard edges, stencil type, lime signal paint on
near-black steel. Every assignment, coding project, and Greek oral text tracked
like cargo on a launch manifest.

Vanilla ES modules. No framework. No bundler. One Bun server whose entire job is
serving files and smuggling Notion API calls past the browser so the key never
leaves the building. Everything two-way syncs with Notion — edit there or here,
last write wins.

```console
nick@mission-control:~$ status
5 views operational. exams T-minus counting. seal not included (wrong repo).
```

## 📋 The views

|     | view                | what it actually does                                                                                                  |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 01  | **DASHBOARD**       | deadline ticker scrolling like a stock exchange of dread, stat cards, urgent list with hazard striping, exam countdown |
| 02  | **ASSIGNMENTS**     | every task, table or kanban. drag, drop, filter, sort. synced with the Notion assignments DB both ways                 |
| 03  | **CODING**          | the projects that eat the hours homework was budgeted for. status, stack chips, repo links — synced with Notion        |
| 04  | **GREEK PORTFOLIO** | Language B oral portfolio. one global issue, a DRAFT → REVISED → FINAL stepper per text                                |
| 05  | **SIDE QUESTS**     | everything else I swore would only take a weekend. projects, tickets, team boards                                      |

## 🚀 Run it

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/nitrimandylis/pm-dashboard.git
cd pm-dashboard
cp .env.example .env       # add your NOTION_API_KEY
bun server.js              # → http://localhost:8080
```

Do **not** open `index.html` directly. ES modules demand HTTP, the Notion sync
demands the proxy, and the dashboard demands respect.

## 🔩 Under the hood

| file           | job                                                                   |
| -------------- | --------------------------------------------------------------------- |
| `index.html`   | sidebar nav + view containers. that's it.                             |
| `js/app.js`    | hash router, one shared modal, all five renderers, sync orchestration |
| `js/data.js`   | constants, localStorage persistence, CRUD                             |
| `js/notion.js` | Notion client + field mapping for four databases                      |
| `style.css`    | the design system: surface ladders, hard shadows, hazard stripes      |
| `server.js`    | Bun static server + `/api/notion/*` proxy. ~100 lines, zero deps      |

Data lives in localStorage, syncs with Notion last-write-wins. Full data model
and design tokens documented in `CLAUDE.md`.

---

<div align="center">

`IB DIPLOMA — YEAR PROGRESS BAR INCLUDED, EMOTIONAL PROGRESS NOT TRACKED`

</div>
