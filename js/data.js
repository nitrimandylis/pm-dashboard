// ============================================================
// DATA — IB Dashboard
// ============================================================

// Private helpers
function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function now() { return new Date().toISOString(); }

// ============================================================
// PROGRAMME DATES
// The two numbers the dashboard countdown is built on. Check these against
// the real exam timetable each September — everything else derives from them.
// ============================================================
export const YEAR_START = '2026-09-01';
export const EXAM_DATE  = '2027-05-01'; // May 2027 session, first paper
export const YEAR_LABEL = '2026/27';

// ============================================================
// CONSTANTS
// Every list below mirrors a Notion select or multi-select. Adding a value
// here that Notion does not have will silently create a new option on push.
// ============================================================

// Notion: Assignments → Subject
export const SUBJECTS = [
  'CS HL', 'Math AA HL', 'English B HL', 'Business SL',
  'Modern Greek A SL', 'Global Politics SL', 'TOK', 'MATH EXTRA', 'Other',
];

// Notion: Assignments → Status and Coding Tasks → Status (same four values)
export const STATUS     = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
export const PRIORITY   = ['HIGH', 'NORMAL', 'LOW'];
export const TASK_TYPES = ['Homework', 'IA', 'Assessment', 'Exam Prep', 'Project', 'Revision'];

// Notion: Side Quests
export const SIDE_QUEST_STATUSES   = ['ONGOING', 'DONE', 'DROPPED'];
export const SIDE_QUEST_CATEGORIES = ['Competition', 'Hackathon', 'MUN', 'Leadership', 'Build', 'Volunteering', 'Academic', 'Other'];
export const SCHOOL_YEARS          = ['Pre-IB', 'Y1', 'Y2'];

// Notion: Coding Projects
export const CODING_STATUSES   = ['IDEA', 'IN_PROGRESS', 'PAUSED', 'SHIPPED', 'ARCHIVED'];
export const CODING_CATEGORIES = ['CLI', 'IB IA', 'Side Project', 'Competition', 'Learning', 'Tool/Automation', 'Web App', 'Config/Files'];
export const CODING_STACKS     = ['Python', 'JavaScript', 'HTML/CSS', 'TypeScript', 'Swift', 'Other'];
export const CODING_TYPES      = ['Private', 'Public'];

// Notion: Modern Greek Portfolio. One row per portfolio entry.
export const GREEK_STATUSES   = ['TODO', 'IN_PROGRESS', 'DONE'];
export const GREEK_TEXTS      = ['Το μίσος', 'Το παλτό', 'Μπάρτλπυ ο γραφέας', 'Γκιακ', 'Τα 400 χτυπήματα', 'Ο ήχος του όπλου', 'Ο ταξιτζής', 'Φωτογραφίες'];
export const GREEK_CONCEPTS   = ['Representation', 'Transformation', 'Perspective', 'Communication', 'Creativity', 'Culture', 'Identity'];
export const GREEK_AREAS      = ['Intertextuality', 'Time and space', 'Readers writers and texts'];
export const GREEK_ASSESSMENT = ['Individual Oral', 'Paper 1 — Guided Analysis', 'Paper 2 — Comparative Essay'];
export const GREEK_FIELDS     = ['Culture identity and community', 'Beliefs values and education', 'Politics power and justice', 'Art creativity and the imagination', 'Science technology and the environment'];
export const GREEK_READING    = ['Language', 'Prose: Non-Fiction', 'Prose: Fiction', 'Poetry', 'Drama'];
export const GREEK_SKILLS     = ['Interactive', 'Productive', 'Receptive'];

// ============================================================
// PERSISTENCE
// Everything is populated from Notion on first sync — there is no seed data.
// ============================================================
const STORE_KEYS = {
  tasks:       'ib_tasks',
  quests:      'ib_quests',
  coding:      'ib_coding',
  codingTasks: 'ib_coding_tasks',
  greek:       'ib_greek',
};

// Bump this string whenever a schema changes to wipe stale localStorage.
const DATA_VERSION     = '7'; // v7: Notion schema re-map — Greek entries, Coding Tasks, no dev-PM tickets
const DATA_VERSION_KEY = 'ib_data_version';

function migrateIfNeeded() {
  if (localStorage.getItem(DATA_VERSION_KEY) === DATA_VERSION) return;
  Object.values(STORE_KEYS).forEach(k => localStorage.removeItem(k));
  // Stores from earlier versions of the dashboard, gone for good
  ['ib_ee', 'ib_projects', 'sbg_tickets', 'sbg_team', 'sbg_active_project', 'sbg_data_version']
    .forEach(k => localStorage.removeItem(k));
  localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
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
export let tasks       = loadData('tasks',       []);
export let quests      = loadData('quests',      []);
export let coding      = loadData('coding',      []);
export let codingTasks = loadData('codingTasks', []);
export let greek       = loadData('greek',       []);

export function generateId(prefix) { return uid(prefix); }

// ============================================================
// ASSIGNMENT CRUD
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

export function setTasks(list) {
  tasks = list;
  saveData('tasks', tasks);
}

// ============================================================
// SIDE QUEST CRUD
// ============================================================
export function createQuest(data) {
  const q = { id: uid('quest'), category: [], ...data };
  quests = [...quests, q];
  saveData('quests', quests);
  return q;
}

export function updateQuest(id, patch) {
  quests = quests.map(q => q.id === id ? { ...q, ...patch } : q);
  saveData('quests', quests);
}

export function deleteQuest(id) {
  quests = quests.filter(q => q.id !== id);
  saveData('quests', quests);
}

export function setQuests(list) {
  quests = list;
  saveData('quests', quests);
}

// ============================================================
// CODING PROJECT CRUD
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
// CODING TASK CRUD
// ============================================================
export function createCodingTask(data) {
  const t = { id: uid('ctask'), createdAt: now(), updatedAt: now(), ...data };
  codingTasks = [...codingTasks, t];
  saveData('codingTasks', codingTasks);
  return t;
}

export function updateCodingTask(id, patch) {
  codingTasks = codingTasks.map(t => t.id === id ? { ...t, ...patch, updatedAt: now() } : t);
  saveData('codingTasks', codingTasks);
}

export function deleteCodingTask(id) {
  codingTasks = codingTasks.filter(t => t.id !== id);
  saveData('codingTasks', codingTasks);
}

export function setCodingTasks(list) {
  codingTasks = list;
  saveData('codingTasks', codingTasks);
}

// ============================================================
// GREEK PORTFOLIO CRUD
// greek is a flat list of portfolio entries, one per Notion row.
// ============================================================
export function createGreekEntry(data) {
  const e = { id: uid('grk'), ...data };
  greek = [...greek, e];
  saveData('greek', greek);
  return e;
}

export function updateGreekEntry(id, patch) {
  greek = greek.map(e => e.id === id ? { ...e, ...patch } : e);
  saveData('greek', greek);
}

export function deleteGreekEntry(id) {
  greek = greek.filter(e => e.id !== id);
  saveData('greek', greek);
}

export function setGreek(list) {
  greek = list;
  saveData('greek', greek);
}
