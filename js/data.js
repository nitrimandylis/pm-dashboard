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
export const PRIORITY   = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'];
export const TASK_TYPES = ['Homework', 'IA', 'Assessment', 'Exam Prep', 'Project', 'Revision'];

export const SIDE_QUEST_STATUSES = ['ACTIVE', 'PAUSED', 'DONE'];
export const GREEK_TEXT_STATUSES = ['DRAFT', 'REVISED', 'FINAL'];

// ============================================================
// SEED DATA
// ============================================================
const SEED_TASKS = [
  { id: 'task_01', title: 'Calculus AA HL Paper 3 practice', subject: 'Math AA HL', deadline: '2026-04-10', priority: 'CRITICAL', status: 'IN_PROGRESS', type: 'Exam Prep', notes: '', notionId: '' },
  { id: 'task_02', title: 'Comparative essay — La Haine', subject: 'Modern Greek SL', deadline: '2026-03-28', priority: 'HIGH', status: 'TODO', type: 'Homework', notes: '', notionId: '' },
  { id: 'task_03', title: 'Cold War essay first draft', subject: 'Global Politics SL', deadline: '2026-03-21', priority: 'HIGH', status: 'IN_PROGRESS', type: 'IA', notes: 'Focus on 1947–1953', notionId: '' },
  { id: 'task_04', title: 'Individual oral recording', subject: 'English B HL', deadline: '2026-04-03', priority: 'HIGH', status: 'TODO', type: 'Assessment', notes: '', notionId: '' },
  { id: 'task_05', title: 'Business IA data analysis', subject: 'Business SL', deadline: '2026-04-15', priority: 'NORMAL', status: 'TODO', type: 'IA', notes: '', notionId: '' },
  { id: 'task_06', title: 'CS HL dossier section 2', subject: 'CS HL', deadline: '2026-03-25', priority: 'HIGH', status: 'REVIEW', type: 'Project', notes: '', notionId: '' },
  { id: 'task_07', title: 'TOK exhibition draft', subject: 'TOK', deadline: '2026-03-31', priority: 'CRITICAL', status: 'TODO', type: 'Assessment', notes: 'Choose 3 objects', notionId: '' },
  { id: 'task_08', title: 'Integration by parts problem set', subject: 'Math AA HL', deadline: '2026-03-20', priority: 'NORMAL', status: 'DONE', type: 'Homework', notes: '', notionId: '' },
  { id: 'task_09', title: 'EE second draft', subject: 'Global Politics SL', deadline: '2026-03-24', priority: 'CRITICAL', status: 'IN_PROGRESS', type: 'IA', notes: 'Target 3800 words', notionId: '' },
  { id: 'task_10', title: 'Greek oral presentation prep', subject: 'Modern Greek SL', deadline: '2026-04-08', priority: 'HIGH', status: 'TODO', type: 'Assessment', notes: '', notionId: '' },
  { id: 'task_11', title: 'CS HL IA criterion D', subject: 'CS HL', deadline: '2026-03-26', priority: 'HIGH', status: 'BLOCKED', type: 'IA', notes: 'Waiting for supervisor feedback', notionId: '' },
  { id: 'task_12', title: 'Business SL mock exam revision', subject: 'Business SL', deadline: '2026-04-20', priority: 'NORMAL', status: 'TODO', type: 'Revision', notes: '', notionId: '' },
  { id: 'task_13', title: 'TOK essay outline', subject: 'TOK', deadline: '2026-04-01', priority: 'HIGH', status: 'TODO', type: 'Homework', notes: '', notionId: '' },
  { id: 'task_14', title: 'English B HL Paper 1 practice', subject: 'English B HL', deadline: '2026-04-22', priority: 'NORMAL', status: 'TODO', type: 'Exam Prep', notes: '', notionId: '' },
];

const SEED_PROJECTS = [
  { id: 'proj_01', name: 'ASKUS', status: 'ACTIVE', lastAction: 'Deployed auth module', nextStep: 'Add question feed UI', priority: 'HIGH' },
  { id: 'proj_02', name: 'ClearFeed', status: 'PAUSED', lastAction: 'RSS parser working', nextStep: 'Design reading view', priority: 'NORMAL' },
  { id: 'proj_03', name: 'Notion Second Brain', status: 'ACTIVE', lastAction: 'IB subject structure done', nextStep: 'Link to assignments', priority: 'NORMAL' },
  { id: 'proj_04', name: 'IB Dashboard', status: 'ACTIVE', lastAction: 'Phase 1 complete', nextStep: 'Build data layer', priority: 'CRITICAL' },
];

const SEED_EE = {
  wordCount: 2400,
  milestones: [
    { id: 'ee_m1', label: 'Research question approved', done: true },
    { id: 'ee_m2', label: 'First draft submitted', done: true },
    { id: 'ee_m3', label: 'Supervisor feedback received', done: true },
    { id: 'ee_m4', label: 'Second draft submitted', done: false },
    { id: 'ee_m5', label: 'Reflection session 1 (RS1)', done: true },
    { id: 'ee_m6', label: 'Reflection session 2 (RS2)', done: false },
    { id: 'ee_m7', label: 'RPPF completed', done: false },
    { id: 'ee_m8', label: 'Final submission', done: false },
  ],
  meetings: [
    { id: 'meet_01', date: '2026-01-15', notes: 'Discussed structure, narrowed RQ to 1956 crisis.' },
    { id: 'meet_02', date: '2026-02-10', notes: 'Feedback: strengthen historiography section.' },
  ],
};

const SEED_GREEK = {
  globalIssue: 'Power, privilege, and resistance: how marginalised voices challenge dominant systems.',
  texts: [
    { id: 'grk_01', title: 'La Haine', wordCount: 520, status: 'REVISED', notes: 'Link to systemic exclusion.' },
    { id: 'grk_02', title: 'Γκιακ', wordCount: 380, status: 'DRAFT', notes: '' },
    { id: 'grk_03', title: 'Μπάρτλμπυ', wordCount: 0, status: 'DRAFT', notes: '' },
    { id: 'grk_04', title: 'Το Παλτό', wordCount: 0, status: 'DRAFT', notes: '' },
  ],
};

// ============================================================
// PERSISTENCE
// ============================================================
const STORE_KEYS = {
  tasks:    'ib_tasks',
  projects: 'ib_projects',
  ee:       'ib_ee',
  greek:    'ib_greek',
};

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
export let ee       = loadData('ee',       SEED_EE);
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
// EE CRUD
// ============================================================
export function updateEE(patch) {
  ee = { ...ee, ...patch };
  saveData('ee', ee);
}

export function addMeeting(data) {
  const m = { id: uid('meet'), ...data };
  ee = { ...ee, meetings: [...ee.meetings, m] };
  saveData('ee', ee);
  return m;
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
  projects:      'sbg_projects',
  tickets:       'sbg_tickets',
  team:          'sbg_team',
  activeProject: 'sbg_active_project',
};

function readPM(key) {
  try { return JSON.parse(localStorage.getItem(PM_KEYS[key])) ?? null; } catch { return null; }
}
function writePM(key, value) { localStorage.setItem(PM_KEYS[key], JSON.stringify(value)); }

// PM Projects
export function getPMProjects() { return readPM('projects') ?? []; }
export function savePMProjects(list) { writePM('projects', list); }
export function createPMProject({ name, phase, description }) {
  const p = { id: uid('proj'), name, phase, description: description || '', createdAt: now() };
  savePMProjects([...getPMProjects(), p]);
  return p;
}
export function updatePMProject(id, patch) {
  savePMProjects(getPMProjects().map(p => p.id === id ? { ...p, ...patch } : p));
}
export function deletePMProject(id) {
  savePMProjects(getPMProjects().filter(p => p.id !== id));
  savePMTickets(getPMTickets().filter(t => t.projectId !== id));
}

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

// PM Seed
export function ensurePMSeed() {
  if (getPMProjects().length > 0) return;
  const p1 = createPMProject({ name: 'API Rewrite', phase: 'BETA', description: 'Migrating REST API to GraphQL with performance improvements.' });
  const p2 = createPMProject({ name: 'Design System', phase: 'ALPHA', description: 'Component library and token system for all product surfaces.' });
  createPMMember({ name: 'Alex M.', initials: 'AM', role: 'Frontend' });
  createPMMember({ name: 'Jordan K.', initials: 'JK', role: 'Backend' });
  createPMMember({ name: 'Sam T.', initials: 'ST', role: 'Design' });
  createPMMember({ name: 'Riley P.', initials: 'RP', role: 'DevOps' });
  createPMTicket({ projectId: p1.id, title: 'Fix auth redirect bug', assignee: 'Alex M.', priority: 'CRITICAL', status: 'BLOCKED' });
  createPMTicket({ projectId: p1.id, title: 'GraphQL schema definition', assignee: 'Jordan K.', priority: 'HIGH', status: 'IN_PROGRESS' });
  createPMTicket({ projectId: p1.id, title: 'Rate limiting middleware', assignee: 'Jordan K.', priority: 'HIGH', status: 'REVIEW' });
  createPMTicket({ projectId: p1.id, title: 'Update API docs', assignee: 'Alex M.', priority: 'NORMAL', status: 'TODO' });
  createPMTicket({ projectId: p1.id, title: 'Migrate user endpoints', assignee: 'Jordan K.', priority: 'HIGH', status: 'DONE' });
  createPMTicket({ projectId: p1.id, title: 'CI/CD pipeline update', assignee: 'Riley P.', priority: 'NORMAL', status: 'BLOCKED' });
  createPMTicket({ projectId: p2.id, title: 'Token system design', assignee: 'Sam T.', priority: 'HIGH', status: 'IN_PROGRESS' });
  createPMTicket({ projectId: p2.id, title: 'Button component variants', assignee: 'Alex M.', priority: 'NORMAL', status: 'TODO' });
  createPMTicket({ projectId: p2.id, title: 'Dark mode tokens', assignee: 'Sam T.', priority: 'NORMAL', status: 'REVIEW' });
  createPMTicket({ projectId: p2.id, title: 'Storybook setup', assignee: 'Riley P.', priority: 'LOW', status: 'DONE' });
  setPMActiveProject(p1.id);
}
