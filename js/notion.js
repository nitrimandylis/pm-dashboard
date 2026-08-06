// ============================================================
// NOTION API CLIENT
// All requests routed through /api/notion/* proxy in server.js
//
// Field maps below were verified against the live databases on 2026-08-06.
// If a write starts 400ing, check the schema before changing anything here.
// ============================================================

const DB_ASSIGNMENTS  = '223cc494-686e-41c4-a564-ae020263974e';
const DB_SIDE_QUESTS  = '3cf2a8dc-1f1e-4538-9776-93ea7ada1af6';
const DB_CODING       = 'cb1788bf-2a1d-4a7e-b3e4-6b5daea238a8';
const DB_CODING_TASKS = 'b0e2b10a-7ffc-4356-b58c-691afabf289c';
const DB_GREEK        = 'd7f59811-62b8-4159-9790-fb32e598607f';

async function notionReq(path, method = 'GET', body = null) {
  const res = await fetch(`/api/notion${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Notion ${res.status}: ${data.message || 'unknown error'}`);
  }
  return data;
}

// ── Shared paginated fetch ────────────────────────────────────────────────

async function queryDatabase(dbId) {
  const pages = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const data = await notionReq(`/databases/${dbId}/query`, 'POST', body);
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return pages;
}

// ── Shared property readers ───────────────────────────────────────────────

function readText(prop)  { return (prop?.rich_text || []).map(r => r.plain_text).join(''); }
function readTitle(prop) { return (prop?.title || []).map(r => r.plain_text).join(''); }
function readMulti(prop) { return (prop?.multi_select || []).map(o => o.name); }

function writeText(value)  { return { rich_text: [{ text: { content: value || '' } }] }; }
function writeTitle(value) { return { title: [{ text: { content: value || '' } }] }; }
function writeMulti(list)  { return { multi_select: (list || []).map(name => ({ name })) }; }
function writeDate(iso)    { return { date: iso ? { start: iso } : null }; }

// ── Generic page helpers ──────────────────────────────────────────────────

export async function fetchPageBody(pageId) {
  const data = await notionReq(`/blocks/${pageId}/children`);
  return data.results
    .filter(b => b.type === 'paragraph')
    .map(b => b.paragraph.rich_text.map(r => r.plain_text).join(''))
    .join('\n');
}

export async function updatePageBody(pageId, text) {
  // Clear existing blocks then write new ones
  const data = await notionReq(`/blocks/${pageId}/children`);
  for (const block of data.results) {
    await notionReq(`/blocks/${block.id}`, 'DELETE');
  }
  if (!text.trim()) return;
  const children = text.split('\n').map(line => ({
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: line } }] },
  }));
  await notionReq(`/blocks/${pageId}/children`, 'PATCH', { children });
}

// ============================================================
// ASSIGNMENTS
// Schema: Task, Subject, Due, Priority, Status, Type, Notes, ManageBac,
//         Overdue (read-only formula — never written).
// ============================================================

export async function fetchAllNotionTasks()            { return queryDatabase(DB_ASSIGNMENTS); }
export async function createNotionTask(task)           { return notionReq('/pages', 'POST', { parent: { database_id: DB_ASSIGNMENTS }, properties: toNotionProps(task) }); }
export async function updateNotionTask(notionId, task) { return notionReq(`/pages/${notionId}`, 'PATCH', { properties: toNotionProps(task) }); }
export async function archiveNotionTask(notionId)      { return notionReq(`/pages/${notionId}`, 'PATCH', { archived: true }); }

function toNotionProps(task) {
  const props = {
    Task:     writeTitle(task.title),
    Due:      writeDate(task.deadline),
    Priority: { select: { name: priorityOut(task.priority) } },
    Status:   { select: { name: statusOut(task.status) } },
    Notes:    writeText(task.notes),
  };
  // Notion rejects null selects — only include optional selects when they have a value
  if (task.subject) props.Subject = { select: { name: task.subject } };
  if (task.type)    props.Type    = { select: { name: task.type } };
  // ManageBac is filled by the siren watcher, not by this dashboard. Read only.
  return props;
}

export function fromNotionPage(page) {
  const p = page.properties;
  return {
    notionId:        page.id,
    title:           readTitle(p.Task),
    subject:         p.Subject?.select?.name || '',
    deadline:        p.Due?.date?.start || '',
    priority:        priorityIn(p.Priority?.select?.name),
    status:          statusIn(p.Status?.select?.name),
    type:            p.Type?.select?.name || '',
    notes:           readText(p.Notes),
    managebacUrl:    p.ManageBac?.url || '',
    notionUpdatedAt: page.last_edited_time,
  };
}

// ── Priority (shared with Coding Tasks) ───────────────────────────────────

const PRIORITY_MAP = { HIGH: '🔥 High', NORMAL: '⚡ Medium', LOW: '🧊 Low' };

function priorityOut(p) { return PRIORITY_MAP[p] || PRIORITY_MAP.NORMAL; }
function priorityIn(n)  { return Object.keys(PRIORITY_MAP).find(k => PRIORITY_MAP[k] === n) || 'NORMAL'; }

// ── Status (shared with Coding Tasks) ─────────────────────────────────────

const STATUS_MAP = {
  TODO:        'To Do',
  IN_PROGRESS: 'In Progress',
  BLOCKED:     'Blocked',
  DONE:        'Done',
};

function statusOut(s) { return STATUS_MAP[s] || 'To Do'; }
function statusIn(n)  { return Object.keys(STATUS_MAP).find(k => STATUS_MAP[k] === n) || 'TODO'; }

// ============================================================
// SIDE QUESTS
// A record of things that happened, not a task list.
// Schema: Name, Status, Date, Role, School Year, Category, Outcome, Notes,
//         Link, Business Venture, plus relations this dashboard leaves alone.
// ============================================================

export async function fetchAllNotionProjects()         { return queryDatabase(DB_SIDE_QUESTS); }
export async function createNotionProject(p)           { return notionReq('/pages', 'POST', { parent: { database_id: DB_SIDE_QUESTS }, properties: toNotionProjectProps(p) }); }
export async function updateNotionProject(notionId, p) { return notionReq(`/pages/${notionId}`, 'PATCH', { properties: toNotionProjectProps(p) }); }
export async function archiveNotionProject(notionId)   { return notionReq(`/pages/${notionId}`, 'PATCH', { archived: true }); }

function toNotionProjectProps(p) {
  const props = {
    Name:     writeTitle(p.name),
    Status:   { select: { name: questStatusOut(p.status) } },
    Date:     writeDate(p.date),
    Role:     writeText(p.role),
    Notes:    writeText(p.notes),
    Outcome:  writeText(p.outcome),
    Category: writeMulti(p.category),
    Link:     { url: p.link || null },
  };
  if (p.schoolYear) props['School Year'] = { select: { name: p.schoolYear } };
  // Business Venture and the CAS / Project relations are curated in Notion. Read only.
  return props;
}

export function fromNotionProject(page) {
  const p = page.properties;
  return {
    notionId:         page.id,
    name:             readTitle(p.Name),
    status:           questStatusIn(p.Status?.select?.name),
    date:             p.Date?.date?.start || '',
    role:             readText(p.Role),
    schoolYear:       p['School Year']?.select?.name || '',
    category:         readMulti(p.Category),
    notes:            readText(p.Notes),
    outcome:          readText(p.Outcome),
    link:             p.Link?.url || '',
    businessVenture:  readMulti(p['Business Venture']),
    notionUpdatedAt:  page.last_edited_time,
  };
}

const QUEST_STATUS_MAP = { ONGOING: 'Ongoing', DONE: 'Done', DROPPED: 'Dropped' };

function questStatusOut(s) { return QUEST_STATUS_MAP[s] || 'Ongoing'; }
function questStatusIn(n)  { return Object.keys(QUEST_STATUS_MAP).find(k => QUEST_STATUS_MAP[k] === n) || 'ONGOING'; }

// ============================================================
// CODING PROJECTS
// Schema: Project, Status, Category, Stack, Type, Description, Repo URL,
//         Started, Last Pushed, GitHub Repo ID, README synced.
// The last three are written by the GitHub Actions sync. Read only here.
// ============================================================

export async function fetchAllNotionCoding()          { return queryDatabase(DB_CODING); }
export async function createNotionCoding(c)           { return notionReq('/pages', 'POST', { parent: { database_id: DB_CODING }, properties: toNotionCodingProps(c) }); }
export async function updateNotionCoding(notionId, c) { return notionReq(`/pages/${notionId}`, 'PATCH', { properties: toNotionCodingProps(c) }); }
export async function archiveNotionCoding(notionId)   { return notionReq(`/pages/${notionId}`, 'PATCH', { archived: true }); }

function toNotionCodingProps(c) {
  const props = {
    Project:     writeTitle(c.name),
    Status:      { select: { name: codingStatusOut(c.status) } },
    Description: writeText(c.description),
    'Repo URL':  { url: c.repoUrl || null },
    Stack:       writeMulti(c.stack),
  };
  if (c.category) props.Category = { select: { name: c.category } };
  if (c.type)     props.Type     = { select: { name: c.type } };
  if (c.started)  props.Started  = writeDate(c.started);
  return props;
}

export function fromNotionCoding(page) {
  const p = page.properties;
  return {
    notionId:        page.id,
    name:            readTitle(p.Project),
    status:          codingStatusIn(p.Status?.select?.name),
    category:        p.Category?.select?.name || '',
    stack:           readMulti(p.Stack),
    type:            p.Type?.select?.name || '',
    description:     readText(p.Description),
    repoUrl:         p['Repo URL']?.url || '',
    started:         p.Started?.date?.start || '',
    lastPushed:      p['Last Pushed']?.date?.start || '',
    notionUpdatedAt: page.last_edited_time,
  };
}

const CODING_STATUS_MAP = {
  IDEA:        'Idea',
  IN_PROGRESS: 'In Progress',
  PAUSED:      'Paused',
  SHIPPED:     'Shipped',
  ARCHIVED:    'Archived',
};

function codingStatusOut(s) { return CODING_STATUS_MAP[s] || 'Idea'; }
function codingStatusIn(n)  { return Object.keys(CODING_STATUS_MAP).find(k => CODING_STATUS_MAP[k] === n) || 'IDEA'; }

// ============================================================
// CODING TASKS
// Schema: Task, Status, Priority, Due, Notes, Project (relation to
//         Coding Projects), On Board (read-only formula — never written).
// Status and Priority share the Assignments vocabulary.
// ============================================================

export async function fetchAllNotionCodingTasks()          { return queryDatabase(DB_CODING_TASKS); }
export async function createNotionCodingTask(t)            { return notionReq('/pages', 'POST', { parent: { database_id: DB_CODING_TASKS }, properties: toNotionCodingTaskProps(t) }); }
export async function updateNotionCodingTask(notionId, t)  { return notionReq(`/pages/${notionId}`, 'PATCH', { properties: toNotionCodingTaskProps(t) }); }
export async function archiveNotionCodingTask(notionId)    { return notionReq(`/pages/${notionId}`, 'PATCH', { archived: true }); }

function toNotionCodingTaskProps(t) {
  return {
    Task:     writeTitle(t.title),
    Status:   { select: { name: statusOut(t.status) } },
    Priority: { select: { name: priorityOut(t.priority) } },
    Due:      writeDate(t.deadline),
    Notes:    writeText(t.notes),
    // Empty relation array is how Notion clears a relation, so this is safe
    // for the learning goals and no-repo tasks that intentionally have no project.
    Project:  { relation: t.projectNotionId ? [{ id: t.projectNotionId }] : [] },
  };
}

export function fromNotionCodingTask(page) {
  const p = page.properties;
  return {
    notionId:        page.id,
    title:           readTitle(p.Task),
    status:          statusIn(p.Status?.select?.name),
    priority:        priorityIn(p.Priority?.select?.name),
    deadline:        p.Due?.date?.start || '',
    notes:           readText(p.Notes),
    projectNotionId: p.Project?.relation?.[0]?.id || '',
    notionUpdatedAt: page.last_edited_time,
  };
}

// ============================================================
// MODERN GREEK PORTFOLIO
// One row per portfolio entry, not per set text.
// Schema: Title, Status, Date, On ManageBac, and six multi-selects:
//         Text / Work / Novel, Concepts, Areas of exploration, Assessment,
//         Fields of Inquiry for Global Issues, Reading Log, Skills.
// ============================================================

export async function fetchAllNotionTexts()         { return queryDatabase(DB_GREEK); }
export async function createNotionText(t)           { return notionReq('/pages', 'POST', { parent: { database_id: DB_GREEK }, properties: toNotionTextProps(t) }); }
export async function updateNotionText(notionId, t) { return notionReq(`/pages/${notionId}`, 'PATCH', { properties: toNotionTextProps(t) }); }
export async function archiveNotionText(notionId)   { return notionReq(`/pages/${notionId}`, 'PATCH', { archived: true }); }

function toNotionTextProps(t) {
  return {
    Title:                                 writeTitle(t.title),
    Status:                                { select: { name: greekStatusOut(t.status) } },
    Date:                                  writeDate(t.date),
    'On ManageBac':                        { checkbox: !!t.onManageBac },
    'Text / Work / Novel':                 writeMulti(t.texts),
    Concepts:                              writeMulti(t.concepts),
    'Areas of exploration':                writeMulti(t.areas),
    Assessment:                            writeMulti(t.assessment),
    'Fields of Inquiry for Global Issues': writeMulti(t.fields),
    'Reading Log':                         writeMulti(t.readingLog),
    Skills:                                writeMulti(t.skills),
  };
}

export function fromNotionText(page) {
  const p = page.properties;
  return {
    notionId:        page.id,
    title:           readTitle(p.Title),
    status:          greekStatusIn(p.Status?.select?.name),
    date:            p.Date?.date?.start || '',
    onManageBac:     !!p['On ManageBac']?.checkbox,
    texts:           readMulti(p['Text / Work / Novel']),
    concepts:        readMulti(p.Concepts),
    areas:           readMulti(p['Areas of exploration']),
    assessment:      readMulti(p.Assessment),
    fields:          readMulti(p['Fields of Inquiry for Global Issues']),
    readingLog:      readMulti(p['Reading Log']),
    skills:          readMulti(p.Skills),
    notionUpdatedAt: page.last_edited_time,
  };
}

// Greek uses "Not Started" where everything else uses "To Do", so it maps onto
// the same three UI states and reuses the shared status styling.
const GREEK_STATUS_MAP = { TODO: 'Not Started', IN_PROGRESS: 'In Progress', DONE: 'Done' };

function greekStatusOut(s) { return GREEK_STATUS_MAP[s] || 'Not Started'; }
function greekStatusIn(n)  { return Object.keys(GREEK_STATUS_MAP).find(k => GREEK_STATUS_MAP[k] === n) || 'TODO'; }
