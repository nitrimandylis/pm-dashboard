// ============================================================
// NOTION API CLIENT
// All requests routed through /api/notion/* proxy in server.js
// ============================================================

const DB_ID = '223cc494-686e-41c4-a564-ae020263974e';

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

// ── Read ──────────────────────────────────────────────────────────────────

export async function fetchAllNotionTasks() {
  const pages = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const data = await notionReq(`/databases/${DB_ID}/query`, 'POST', body);
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return pages;
}

// ── Write ─────────────────────────────────────────────────────────────────

export async function createNotionTask(task) {
  return notionReq('/pages', 'POST', {
    parent: { database_id: DB_ID },
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
  if (p === 'CRITICAL' || p === 'HIGH') return { name: '🔥 High' };
  if (p === 'LOW')                       return { name: '🧊 Low' };
  return                                        { name: '⚡ Medium' };
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
