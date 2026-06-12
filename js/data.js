// ============================================================
// DATA — IB Dashboard 2025-26
// ============================================================

// Private helpers
function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function now() { return new Date().toISOString(); }

// ============================================================
// CONSTANTS
// ============================================================
// Subjects match Notion Assignments database
export const SUBJECTS = [
  'CS HL', 'Math AA HL', 'English B HL', 'Business SL',
  'Modern Greek SL', 'Global Politics SL', 'TOK', 'Other'
];

export const STATUS     = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'];
export const PRIORITY   = ['HIGH', 'NORMAL', 'LOW'];
export const TASK_TYPES = ['Homework', 'IA', 'Assessment', 'Exam Prep', 'Project', 'Revision'];

export const SIDE_QUEST_STATUSES = ['ACTIVE', 'PAUSED', 'DONE'];
export const GREEK_TEXT_STATUSES = ['DRAFT', 'REVISED', 'FINAL'];

// Match Notion Coding Projects database
export const CODING_STATUSES   = ['IDEA', 'IN_PROGRESS', 'PAUSED', 'SHIPPED', 'ARCHIVED'];
export const CODING_CATEGORIES = ['IB IA', 'Side Project', 'Competition', 'Learning', 'Tool/Automation', 'Web App'];
export const CODING_STACKS     = ['Python', 'JavaScript', 'HTML/CSS', 'TypeScript', 'Swift', 'React', 'Node.js', 'Flask', 'Other'];
export const CODING_TYPES      = ['Private', 'Public'];

// ============================================================
// SEED DATA
// ============================================================
const SEED_TASKS = []; // Populated from Notion on first sync

const SEED_PROJECTS = [];

const SEED_CODING = []; // Populated from Notion on first sync

const SEED_GREEK = {
  globalIssue: '',
  texts: [],
};

// ============================================================
// PERSISTENCE
// ============================================================
const STORE_KEYS = {
  tasks:    'ib_tasks',
  projects: 'ib_projects',
  coding:   'ib_coding',
  greek:    'ib_greek',
};

// Bump this string whenever the tasks schema changes to wipe stale localStorage.
const DATA_VERSION     = '6'; // v6: EE tracker replaced by coding projects
const DATA_VERSION_KEY = 'ib_data_version';

function migrateIfNeeded() {
  if (localStorage.getItem(DATA_VERSION_KEY) !== DATA_VERSION) {
    Object.values(STORE_KEYS).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('ib_ee'); // legacy EE tracker store
    localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
  }
}

migrateIfNeeded();

export function loadData(key, seed) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEYS[key]));
    return stored ?? seed;
  } catch {
    return seed;
  }
}

export function saveData(key, value) {
  localStorage.setItem(STORE_KEYS[key], JSON.stringify(value));
}

// ============================================================
// MUTABLE STATE (live bindings)
// ============================================================
export let tasks    = loadData('tasks',    SEED_TASKS);
export let projects = loadData('projects', SEED_PROJECTS);
export let coding   = loadData('coding',   SEED_CODING);
export let greek    = loadData('greek',    SEED_GREEK);

// ============================================================
// TASK CRUD
// ============================================================
export function createTask(data) {
  const t = { id: uid('task'), createdAt: now(), updatedAt: now(), ...data };
  tasks = [...tasks, t];
  saveData('tasks', tasks);
  return t;
}

export function updateTask(id, patch) {
  tasks = tasks.map(t => t.id === id ? { ...t, ...patch, updatedAt: now() } : t);
  saveData('tasks', tasks);
}

export function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveData('tasks', tasks);
}

// Bulk-replace tasks (used by Notion sync)
export function setTasks(newTasks) {
  tasks = newTasks;
  saveData('tasks', tasks);
}

export function generateId(prefix) { return uid(prefix); }

// ============================================================
// PROJECT CRUD
// ============================================================
export function createProject(data) {
  const p = { id: uid('proj'), ...data };
  projects = [...projects, p];
  saveData('projects', projects);
  return p;
}

export function updateProject(id, patch) {
  projects = projects.map(p => p.id === id ? { ...p, ...patch } : p);
  saveData('projects', projects);
}

export function deleteProject(id) {
  projects = projects.filter(p => p.id !== id);
  saveData('projects', projects);
}

// ============================================================
// CODING CRUD
// ============================================================
export function createCoding(data) {
  const c = { id: uid('code'), stack: [], ...data };
  coding = [...coding, c];
  saveData('coding', coding);
  return c;
}

export function updateCoding(id, patch) {
  coding = coding.map(c => c.id === id ? { ...c, ...patch } : c);
  saveData('coding', coding);
}

export function deleteCoding(id) {
  coding = coding.filter(c => c.id !== id);
  saveData('coding', coding);
}

export function setCoding(list) {
  coding = list;
  saveData('coding', coding);
}

// ============================================================
// GREEK CRUD
// ============================================================
export function updateGreek(patch) {
  greek = { ...greek, ...patch };
  saveData('greek', greek);
}

export function updateGreekText(id, patch) {
  greek = {
    ...greek,
    texts: greek.texts.map(t => t.id === id ? { ...t, ...patch } : t),
  };
  saveData('greek', greek);
}

// ============================================================
// PM DATA — Dev Team Project Manager (legacy feature set)
// ============================================================
const PM_KEYS = {
  tickets:       'sbg_tickets',
  team:          'sbg_team',
  activeProject: 'sbg_active_project',
};

// Bump to wipe stale seed data from localStorage
const PM_DATA_VERSION     = '2';
const PM_DATA_VERSION_KEY = 'sbg_data_version';
if (localStorage.getItem(PM_DATA_VERSION_KEY) !== PM_DATA_VERSION) {
  ['sbg_tickets', 'sbg_team', 'sbg_active_project'].forEach(k => localStorage.removeItem(k));
  localStorage.setItem(PM_DATA_VERSION_KEY, PM_DATA_VERSION);
}

function readPM(key) {
  try { return JSON.parse(localStorage.getItem(PM_KEYS[key])) ?? null; } catch { return null; }
}
function writePM(key, value) { localStorage.setItem(PM_KEYS[key], JSON.stringify(value)); }

// PM Tickets
export function getPMTickets() { return readPM('tickets') ?? []; }
export function savePMTickets(list) { writePM('tickets', list); }
export function createPMTicket({ projectId, title, assignee, priority, status, description, dueDate }) {
  const t = {
    id: uid('tick'), projectId, title,
    assignee: assignee || '', priority: priority || 'NORMAL', status: status || 'TODO',
    description: description || '', dueDate: dueDate || '',
    createdAt: now(), updatedAt: now(),
  };
  savePMTickets([...getPMTickets(), t]);
  return t;
}
export function updatePMTicket(id, patch) {
  savePMTickets(getPMTickets().map(t => t.id === id ? { ...t, ...patch, updatedAt: now() } : t));
}
export function deletePMTicket(id) { savePMTickets(getPMTickets().filter(t => t.id !== id)); }

// PM Team
export function getPMTeam() { return readPM('team') ?? []; }
export function savePMTeam(list) { writePM('team', list); }
export function createPMMember({ name, initials, role }) {
  const m = { id: uid('member'), name, initials, role };
  savePMTeam([...getPMTeam(), m]);
  return m;
}
export function updatePMMember(id, patch) {
  savePMTeam(getPMTeam().map(m => m.id === id ? { ...m, ...patch } : m));
}
export function deletePMMember(id) { savePMTeam(getPMTeam().filter(m => m.id !== id)); }

// PM Active Project
export function getPMActiveProject() { return readPM('activeProject'); }
export function setPMActiveProject(id) { writePM('activeProject', id); }

