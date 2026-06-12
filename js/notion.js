// ============================================================
// NOTION API CLIENT
// All requests routed through /api/notion/* proxy in server.js
// ============================================================

const DB_ASSIGNMENTS = '223cc494-686e-41c4-a564-ae020263974e';
const DB_SIDE_QUESTS = '3cf2a8dc-1f1e-4538-9776-93ea7ada1af6';
const DB_CODING      = 'cb1788bf-2a1d-4a7e-b3e4-6b5daea238a8';
const DB_GREEK       = 'd7f59811-62b8-4159-9790-fb32e598607f';

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

// ── Read ──────────────────────────────────────────────────────────────────

export async function fetchAllNotionTasks() {
  return queryDatabase(DB_ASSIGNMENTS);
}

// ── Write ─────────────────────────────────────────────────────────────────

export async function createNotionTask(task) {
  return notionReq('/pages', 'POST', {
    parent: { database_id: DB_ASSIGNMENTS },
    properties: toNotionProps(task, true),
  });
}

export async function updateNotionTask(notionId, task) {
  return notionReq(`/pages/${notionId}`, 'PATCH', {
    properties: toNotionProps(task, false),
  });
}

export async function archiveNotionTask(notionId) {
  return notionReq(`/pages/${notionId}`, 'PATCH', { archived: true });
}

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

// ── Field mapping: dashboard → Notion ────────────────────────────────────

function toNotionProps(task, isCreate = false) {
  const props = {
    Task:     { title: [{ text: { content: task.title || '' } }] },
    Due:      { date: task.deadline  ? { start: task.deadline } : null },
    Priority: { select: priorityOut(task.priority) },
    Status:   { select: statusOut(task.status) },
    Notes:    { rich_text: [{ text: { content: task.notes || '' } }] },
  };
  // Notion rejects null selects — only include optional selects when they have a value
  if (task.subject) props.Subject = { select: { name: task.subject } };
  if (task.type)    props.Type    = { select: { name: task.type } };
  if (isCreate)     props.Source  = { select: { name: 'PM-dashboard' } };
  return props;
}

// ── Field mapping: Notion → dashboard ────────────────────────────────────

export function fromNotionPage(page) {
  const p = page.properties;
  return {
    notionId:        page.id,
    title:           p.Task?.title?.[0]?.plain_text || '',
    subject:         p.Subject?.select?.name || '',
    deadline:        p.Due?.date?.start || '',
    priority:        priorityIn(p.Priority?.select?.name),
    status:          statusIn(p.Status?.select?.name),
    type:            p.Type?.select?.name || '',
    notes:           p.Notes?.rich_text?.[0]?.plain_text || '',
    notionUpdatedAt: page.last_edited_time,
  };
}

// ── Priority ──────────────────────────────────────────────────────────────

function priorityOut(p) {
  if (p === 'HIGH') return { name: '🔥 High' };
  if (p === 'LOW')  return { name: '🧊 Low' };
  return                   { name: '⚡ Medium' };
}

function priorityIn(n) {
  if (n === '🔥 High')  return 'HIGH';
  if (n === '🧊 Low')   return 'LOW';
  return 'NORMAL';
}

// ── Status ────────────────────────────────────────────────────────────────

function statusOut(s) {
  if (s === 'DONE')                      return { name: 'Done' };
  if (s === 'IN_PROGRESS' || s === 'REVIEW') return { name: 'In Progress' };
  if (s === 'BLOCKED')                   return { name: 'Overdue' };
  return                                        { name: 'To Do' };
}

function statusIn(n) {
  if (n === 'Done')        return 'DONE';
  if (n === 'In Progress') return 'IN_PROGRESS';
  if (n === 'Overdue')     return 'BLOCKED';
  return 'TODO';
}

// ── Side Quests ───────────────────────────────────────────────────────────

export async function fetchAllNotionProjects()         { return queryDatabase(DB_SIDE_QUESTS); }
export async function createNotionProject(p)           { return notionReq('/pages', 'POST', { parent: { database_id: DB_SIDE_QUESTS }, properties: toNotionProjectProps(p) }); }
export async function updateNotionProject(notionId, p) { return notionReq(`/pages/${notionId}`, 'PATCH', { properties: toNotionProjectProps(p) }); }
export async function archiveNotionProject(notionId)   { return notionReq(`/pages/${notionId}`, 'PATCH', { archived: true }); }

function toNotionProjectProps(p) {
  return {
    Name:    { title: [{ text: { content: p.name || '' } }] },
    Status:  { select: projectStatusOut(p.status) },
    Notes:   { rich_text: [{ text: { content: p.lastAction || '' } }] },
    Outcome: { rich_text: [{ text: { content: p.nextStep  || '' } }] },
  };
}

export function fromNotionProject(page) {
  const p = page.properties;
  return {
    notionId:         page.id,
    name:             p.Name?.title?.[0]?.plain_text || '',
    status:           projectStatusIn(p.Status?.select?.name),
    lastAction:       p.Notes?.rich_text?.[0]?.plain_text   || '',
    nextStep:         p.Outcome?.rich_text?.[0]?.plain_text || '',
    _notionCategory:  (p.Category?.multi_select || []).map(c => c.name),
    _notionBusiness:  (p['Business Venture']?.multi_select || []).map(c => c.name),
    _notionLink:      p.Link?.url || '',
    notionUpdatedAt:  page.last_edited_time,
  };
}

function projectStatusOut(s) {
  if (s === 'ACTIVE') return { name: 'In Progress' };
  if (s === 'DONE')   return { name: 'Completed' };
  return                     { name: 'Planning' };
}

function projectStatusIn(n) {
  if (n === 'In Progress')                  return 'ACTIVE';
  if (n === 'Completed' || n === 'Abandoned') return 'DONE';
  return 'PAUSED';
}

// ── Coding Projects ───────────────────────────────────────────────────────

export async function fetchAllNotionCoding()            { return queryDatabase(DB_CODING); }
export async function createNotionCoding(c)             { return notionReq('/pages', 'POST', { parent: { database_id: DB_CODING }, properties: toNotionCodingProps(c) }); }
export async function updateNotionCoding(notionId, c)   { return notionReq(`/pages/${notionId}`, 'PATCH', { properties: toNotionCodingProps(c) }); }
export async function archiveNotionCoding(notionId)     { return notionReq(`/pages/${notionId}`, 'PATCH', { archived: true }); }

function toNotionCodingProps(c) {
  const props = {
    Project:       { title: [{ text: { content: c.name || '' } }] },
    Status:        { select: { name: codingStatusOut(c.status) } },
    Description:   { rich_text: [{ text: { content: c.description || '' } }] },
    'Repo URL':    { url: c.repoUrl || null },
    Stack:         { multi_select: (c.stack || []).map(name => ({ name })) },
  };
  // Notion rejects null selects — only include optional selects when they have a value
  if (c.category) props.Category = { select: { name: c.category } };
  if (c.type)     props.Type     = { select: { name: c.type } };
  if (c.started)  props.Started  = { date: { start: c.started } };
  return props;
}

export function fromNotionCoding(page) {
  const p = page.properties;
  return {
    notionId:        page.id,
    name:            p.Project?.title?.[0]?.plain_text || '',
    status:          codingStatusIn(p.Status?.select?.name),
    category:        p.Category?.select?.name || '',
    stack:           (p.Stack?.multi_select || []).map(s => s.name),
    type:            p.Type?.select?.name || '',
    description:     p.Description?.rich_text?.[0]?.plain_text || '',
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

function codingStatusIn(n) {
  return Object.keys(CODING_STATUS_MAP).find(k => CODING_STATUS_MAP[k] === n) || 'IDEA';
}

// ── Greek Portfolio ───────────────────────────────────────────────────────

export async function fetchAllNotionTexts()              { return queryDatabase(DB_GREEK); }
export async function createNotionText(t)                { return notionReq('/pages', 'POST', { parent: { database_id: DB_GREEK }, properties: toNotionTextProps(t) }); }
export async function updateNotionText(notionId, t)      { return notionReq(`/pages/${notionId}`, 'PATCH', { properties: toNotionTextProps(t) }); }
export async function archiveNotionText(notionId)        { return notionReq(`/pages/${notionId}`, 'PATCH', { archived: true }); }

function toNotionTextProps(t) {
  return {
    Title:  { title: [{ text: { content: t.title || '' } }] },
    Status: { select: greekStatusOut(t.status) },
  };
}

export function fromNotionText(page) {
  const p = page.properties;
  return {
    notionId:        page.id,
    title:           p.Title?.title?.[0]?.plain_text || '',
    status:          greekStatusIn(p.Status?.select?.name),
    notionUpdatedAt: page.last_edited_time,
  };
}

function greekStatusOut(s) {
  if (s === 'REVISED') return { name: 'In Progress' };
  if (s === 'FINAL')   return { name: 'Done' };
  return                      { name: 'Not Started' };
}

function greekStatusIn(n) {
  if (n === 'In Progress') return 'REVISED';
  if (n === 'Done')        return 'FINAL';
  return 'DRAFT';
}
