<div align="center">

```
 ██╗██████╗     ██╗██████╗  ██████╗
 ██║██╔══██╗   ██╔╝╚════██╗██╔════╝
 ██║██████╔╝  ██╔╝  █████╔╝███████╗
 ██║██╔══██╗ ██╔╝  ██╔═══╝ ██╔═══██╗
 ██║██████╔╝██╔╝   ███████╗╚██████╔╝
 ╚═╝╚═════╝ ╚═╝    ╚══════╝ ╚═════╝
```

### IB coursework dashboard

_a small web app I built to keep track of my own Diploma Programme work_

![runtime](https://img.shields.io/badge/runtime-bun-E8FF47?style=flat-square&labelColor=111111)
![dependencies](https://img.shields.io/badge/dependencies-0-E8FF47?style=flat-square&labelColor=111111)
![data](https://img.shields.io/badge/data-notion-47C3FF?style=flat-square&labelColor=111111)
![license](https://img.shields.io/badge/license-MIT-47C3FF?style=flat-square&labelColor=111111)

</div>

---

## What is this

A single-page dashboard for my IB Diploma coursework. Assignments, coding tasks,
Modern Greek portfolio entries and the extracurricular things I have done, all
in one place, reading from the Notion databases I already keep.

I built it for myself, mostly to find out how far plain ES modules get you with
no framework and no build step. It is a school project, not a product. Nobody
else uses it and there is nothing to sign up for.

The five Notion database IDs at the top of `js/notion.js` point at my own
workspace, so cloning this and running it will not do anything useful until you
swap in your own. The field maps assume my property names too.

Vanilla ES modules, no bundler. One Bun server that serves the files and
forwards Notion API calls so the API key stays out of the browser. All five
databases sync both ways: edit in Notion or here, last write wins.

## The views

|     | view                | what it shows                                                                                              |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| 01  | **DASHBOARD**       | scrolling deadline ticker, stat cards, an urgent list, subject load bars, exam countdown                    |
| 02  | **ASSIGNMENTS**     | every assignment as a table or a kanban board, with drag and drop, filters and sorting. ManageBac links come from a separate scraper of mine |
| 03  | **CODING**          | two tabs, one for my side projects and one for the task board that runs them                                |
| 04  | **GREEK PORTFOLIO** | Modern Greek A SL, one card per portfolio entry, tagged by text, assessment, concept and area                |
| 05  | **SIDE QUESTS**     | a log of competitions, hackathons, MUN and ventures. What happened, not what is next                        |

## Running it

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/nitrimandylis/pm-dashboard.git
cd pm-dashboard
cp .env.example .env       # add your NOTION_API_KEY
bun server.js              # → http://localhost:8090
```

Do not open `index.html` straight from the filesystem. ES modules need to be
served over HTTP, and the Notion sync needs the proxy in `server.js`.

Port 8090 rather than 8080 because another local project of mine already sits
on 8080. Override it with `PORT` in `.env`.

## How it fits together

| file           | job                                                              |
| -------------- | ---------------------------------------------------------------- |
| `index.html`   | sidebar nav and the five view containers                          |
| `js/app.js`    | hash router, one shared modal, the five renderers, sync engine    |
| `js/data.js`   | programme dates, constants, localStorage persistence, CRUD        |
| `js/notion.js` | Notion client and field mapping for the five databases            |
| `style.css`    | the design system: surface ladders, hard shadows, hazard stripes  |
| `server.js`    | Bun static server plus the `/api/notion/*` proxy, 82 lines, no deps |

## Things to know before using it

- Local state lives in `localStorage`, so it is per browser and does not follow
  you between machines. Notion is the real store.
- No auth and no accounts. It assumes one person on one laptop, which is me.
- No tests.
- `EXAM_DATE`, `YEAR_START` and `YEAR_LABEL` are constants in `js/data.js`. The
  countdown and the year progress bar come entirely from those, so they need
  checking against the real timetable each September.
- Writing a select value that Notion does not already have will silently create
  a new option rather than fail, so the constant lists in `js/data.js` have to
  match the databases.

The data model, the sync rules and the design tokens are written up in
`CLAUDE.md`.
