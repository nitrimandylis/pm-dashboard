// ============================================================
// IMPORTS
// ============================================================
import {
  YEAR_START, EXAM_DATE, YEAR_LABEL,
  SUBJECTS, STATUS, PRIORITY, TASK_TYPES,
  SIDE_QUEST_STATUSES, SIDE_QUEST_CATEGORIES, SCHOOL_YEARS,
  CODING_STATUSES, CODING_CATEGORIES, CODING_STACKS, CODING_TYPES,
  GREEK_STATUSES, GREEK_TEXTS, GREEK_CONCEPTS, GREEK_AREAS,
  GREEK_ASSESSMENT, GREEK_FIELDS, GREEK_READING, GREEK_SKILLS,
  generateId,
  tasks, createTask, updateTask, deleteTask, setTasks,
  quests, createQuest, updateQuest, deleteQuest, setQuests,
  coding, createCoding, updateCoding, deleteCoding, setCoding,
  codingTasks, createCodingTask, updateCodingTask, deleteCodingTask, setCodingTasks,
  greek, createGreekEntry, updateGreekEntry, deleteGreekEntry, setGreek,
} from './data.js';

import {
  fetchPageBody, updatePageBody,
  fetchAllNotionTasks, createNotionTask, updateNotionTask, archiveNotionTask, fromNotionPage,
  fetchAllNotionProjects, createNotionProject, updateNotionProject, archiveNotionProject, fromNotionProject,
  fetchAllNotionCoding, createNotionCoding, updateNotionCoding, archiveNotionCoding, fromNotionCoding,
  fetchAllNotionCodingTasks, createNotionCodingTask, updateNotionCodingTask, archiveNotionCodingTask, fromNotionCodingTask,
  fetchAllNotionTexts, createNotionText, updateNotionText, archiveNotionText, fromNotionText,
} from './notion.js';

// ============================================================
// ROUTER
// ============================================================
const views = {};

function registerView(id, render) {
  views[id] = render;
}

function navigateTo(viewId) {
  if (window.location.hash !== `#${viewId}`) {
    window.location.hash = viewId;
  } else {
    activateView(viewId);
  }
}

function activateView(viewId) {
  if (!views[viewId]) return;
  closeModal(); // an open modal belongs to the view being left
  document.querySelectorAll('main [data-view]').forEach(el => el.style.display = 'none');
  const container = document.querySelector(`main [data-view="${viewId}"]`);
  if (container) container.style.display = '';
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('nav-active', el.dataset.view === viewId);
  });
  updateMeta(viewId);
  views[viewId]();
}

function initRouter(defaultView) {
  // Fall back to the default so an old bookmark (#projects) is not a blank page
  const resolve = () => {
    const id = window.location.hash.slice(1);
    return views[id] ? id : defaultView;
  };
  window.addEventListener('hashchange', () => activateView(resolve()));
  activateView(resolve());
}

// ============================================================
// MODAL
// ============================================================
let modalOverlay, modalBox;

function initModal() {
  modalOverlay = document.getElementById('modal-overlay');
  modalBox = document.getElementById('modal-box');
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function openModal({ title, fields, onSubmit, submitLabel = 'CREATE' }) {
  modalBox.innerHTML = `
    <div class="modal-header">
      <div class="display-text modal-title">${title}</div>
      <button class="modal-close-btn" id="modal-close-btn">&#x2715;</button>
    </div>
    <form id="modal-form">
      ${fields.map(renderField).join('')}
      <button type="submit" class="modal-submit">${submitLabel}</button>
    </form>`;
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-form').addEventListener('submit', e => {
    e.preventDefault();
    onSubmit(collectFields(new FormData(e.target), fields));
    closeModal();
  });
  modalOverlay.classList.add('active');
  modalBox.querySelector('input, select, textarea')?.focus();
}

// FormData collapses repeated names, so multi and checkbox fields are read
// explicitly rather than through Object.fromEntries.
function collectFields(fd, fields) {
  const data = {};
  for (const f of fields) {
    if (f.type === 'multi')         data[f.name] = fd.getAll(f.name);
    else if (f.type === 'checkbox') data[f.name] = fd.get(f.name) === 'on';
    else                            data[f.name] = fd.get(f.name) ?? '';
  }
  return data;
}

function renderField({ name, label, type = 'text', options, required = true, defaultValue = '' }) {
  const req = required ? 'required' : '';
  const defVal = esc(defaultValue);

  if (type === 'select') {
    return `<div class="modal-field">
      <label class="mono-label modal-label">${label}</label>
      <select name="${name}" ${req} class="modal-input">
        ${(options || []).map(o => {
          const val = o.value ?? o;
          const lbl = o.label ?? o;
          const sel = String(val) === String(defaultValue) ? 'selected' : '';
          return `<option value="${esc(val)}" ${sel}>${esc(lbl)}</option>`;
        }).join('')}
      </select></div>`;
  }

  if (type === 'multi') {
    const chosen = new Set(defaultValue || []);
    return `<div class="modal-field">
      <label class="mono-label modal-label">${label}</label>
      <div class="chip-picker">
        ${(options || []).map(o => `
          <label class="chip-option ${chosen.has(o) ? 'chip-on' : ''}">
            <input type="checkbox" name="${name}" value="${esc(o)}" ${chosen.has(o) ? 'checked' : ''}>
            <span>${esc(o)}</span>
          </label>`).join('')}
      </div></div>`;
  }

  if (type === 'checkbox') {
    return `<div class="modal-field modal-field-inline">
      <label class="chip-option ${defaultValue ? 'chip-on' : ''}">
        <input type="checkbox" name="${name}" ${defaultValue ? 'checked' : ''}>
        <span>${label}</span>
      </label></div>`;
  }

  if (type === 'textarea') {
    return `<div class="modal-field">
      <label class="mono-label modal-label">${label}</label>
      <textarea name="${name}" ${req} class="modal-input modal-textarea" rows="3">${defVal}</textarea></div>`;
  }

  return `<div class="modal-field">
    <label class="mono-label modal-label">${label}</label>
    <input type="${type}" name="${name}" ${req} class="modal-input" value="${defVal}"></div>`;
}

function closeModal() { modalOverlay?.classList.remove('active'); }

// Chip pickers toggle their own styling — the checkbox itself stays the state.
document.addEventListener('change', e => {
  if (e.target.matches('.chip-option input[type="checkbox"]')) {
    e.target.closest('.chip-option').classList.toggle('chip-on', e.target.checked);
  }
});

// ============================================================
// HELPERS
// ============================================================
function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtStatus(s) { return s.replace(/_/g, ' '); }

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y.slice(2)}`;
}

function daysUntil(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline) - new Date()) / 86400000);
}

function subjectSlug(s) {
  return s.toLowerCase().replace(/\s+/g, '-');
}

function subjectBadge(subject) {
  if (!subject) return '';
  return `<span class="subject-badge subj-${subjectSlug(subject)} mono-label">${esc(subject)}</span>`;
}

function chips(list) {
  return (list || []).map(c => `<span class="due-chip">${esc(c)}</span>`).join('');
}

function dueChip(deadline, status) {
  const days = daysUntil(deadline);
  if (days === null) return '';
  const overdue = days < 0 && status !== 'DONE';
  return overdue
    ? `<span class="due-chip chip-danger">${Math.abs(days)}d OVERDUE</span>`
    : `<span class="due-chip">${days}d LEFT</span>`;
}

function getISOWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// Confirm-then-act on a delete button, so a stray click cannot destroy a row.
function armDelete(btn, label, onConfirm) {
  if (btn.dataset.confirm) { onConfirm(); return; }
  btn.dataset.confirm = '1';
  btn.textContent = 'SURE?';
  btn.style.color = 'var(--status-blocked)';
  setTimeout(() => {
    if (btn.dataset.confirm) {
      btn.dataset.confirm = '';
      btn.innerHTML = label;
      btn.style.color = '';
    }
  }, 3000);
}

const VIEW_TITLES = {
  'dashboard':       'Dashboard',
  'assignments':     'Assignments',
  'coding':          'Coding',
  'greek-portfolio': 'Greek Portfolio',
  'side-quests':     'Side Quests',
};

function updateMeta(viewId) {
  const crumb = document.getElementById('header-breadcrumb');
  if (crumb && viewId) crumb.textContent = 'HOME / ' + viewId.toUpperCase().replace(/-/g, ' ');
  const title = document.getElementById('header-title');
  if (title && viewId) title.textContent = VIEW_TITLES[viewId] || viewId.replace(/-/g, ' ');
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const container = document.querySelector('main [data-view="dashboard"]');
  if (!container) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const notDone = tasks.filter(t => t.status !== 'DONE');
  const overdue = notDone.filter(t => t.deadline && new Date(t.deadline) < today);
  const thisWeek = notDone.filter(t => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    return d >= today && d <= weekEnd;
  });
  const openDev = codingTasks.filter(t => t.status !== 'DONE');

  // Urgent: anything overdue, plus HIGH priority landing inside the week
  const urgent = notDone.filter(t => {
    if (t.deadline && new Date(t.deadline) < today) return true;
    if (t.priority === 'HIGH' && t.deadline) {
      const d = new Date(t.deadline);
      return d >= today && d <= weekEnd;
    }
    return false;
  }).sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));

  // Subject load
  const subjectLoad = {};
  SUBJECTS.forEach(s => { subjectLoad[s] = 0; });
  notDone.forEach(t => { if (t.subject in subjectLoad) subjectLoad[t.subject]++; });
  const maxLoad = Math.max(1, ...Object.values(subjectLoad));

  // Exam countdown + academic year progress
  const examDate = new Date(EXAM_DATE);
  const daysLeft = Math.ceil((examDate - new Date()) / 86400000);
  const examsPast = daysLeft < 0;
  const yearStart = new Date(YEAR_START);
  const yearPct = Math.min(100, Math.max(0,
    Math.round(((Date.now() - yearStart) / (examDate - yearStart)) * 100)
  ));

  // Deadline ticker: assignments and dev tasks due within 14 days, soonest first
  const upcoming = [
    ...notDone.map(t => ({ label: t.subject, title: t.title, deadline: t.deadline })),
    ...openDev.map(t => ({ label: 'DEV', title: t.title, deadline: t.deadline })),
  ].filter(t => {
    const d = daysUntil(t.deadline);
    return d !== null && d >= 0 && d <= 14;
  }).sort((a, b) => a.deadline.localeCompare(b.deadline));

  const tickerItems = (upcoming.length ? upcoming.map(t => {
    const d = daysUntil(t.deadline);
    const dLabel = d === 0 ? '<span class="hot">DUE TODAY</span>'
      : d <= 3 ? `<span class="hot">${d}D LEFT</span>`
      : `${d}D LEFT`;
    return `<span class="ticker-item"><span class="sep">&#x25B6;</span>${esc(t.label)} — ${esc(t.title)} — ${dLabel}</span>`;
  }) : ['<span class="ticker-item"><span class="sep">&#x25B6;</span>NO DEADLINES IN THE NEXT 14 DAYS — CLEAR RUNWAY</span>']).join('');

  const stats = [
    { v: notDone.length,  l: 'OPEN',          cls: '' },
    { v: overdue.length,  l: 'OVERDUE',       cls: 'stat-danger' },
    { v: thisWeek.length, l: 'DUE THIS WEEK', cls: 'stat-review' },
    { v: openDev.length,  l: 'DEV TASKS',     cls: 'stat-done' },
  ];

  container.innerHTML = `
    <div class="ticker-wrap" aria-hidden="true">
      <div class="ticker">
        <div class="ticker-group">${tickerItems}</div>
        <div class="ticker-group">${tickerItems}</div>
      </div>
    </div>

    <div class="stat-row">
      ${stats.map((s, i) => `
        <div class="stat-card ${s.cls}">
          <div class="stat-index mono-label">0${i + 1}</div>
          <div class="stat-value display-text">${s.v}</div>
          <div class="mono-label stat-label">${s.l}</div>
        </div>`).join('')}
    </div>

    <div class="dashboard-grid">
      <section class="data-section">
        <div class="section-header display-text">
          URGENT
          <span class="tag">ACTION NEEDED</span>
        </div>
        <div class="task-list">
          ${urgent.length ? urgent.map(t => {
            const days = daysUntil(t.deadline);
            const isOverdue = days !== null && days < 0;
            return `<div class="task-row ${isOverdue ? 'overdue-row' : ''}">
              <div class="task-title">${esc(t.title)} ${dueChip(t.deadline, t.status)}</div>
              <div>${subjectBadge(t.subject)}</div>
              <div class="priority-badge p-${t.priority}">${t.priority}</div>
              <div class="status-badge s-${t.status}">${fmtStatus(t.status)}</div>
            </div>`;
          }).join('') : '<div class="empty-state">All clear — no urgent items.</div>'}
        </div>
      </section>

      <section class="data-section">
        <div class="section-header display-text">
          SUBJECT LOAD
          <span class="tag">OPEN TASKS</span>
        </div>
        <div>
          ${SUBJECTS.map(s => {
            const count = subjectLoad[s];
            const pct = Math.round((count / maxLoad) * 100);
            return `<div class="workload-row">
              <div class="workload-info">
                <div class="workload-name">${esc(s)}</div>
                <div class="workload-bar-wrap"><div class="workload-bar" style="width:${pct}%"></div></div>
              </div>
              <div class="workload-count">${count}</div>
            </div>`;
          }).join('')}
        </div>
      </section>

      <div class="notice-board">
        <div class="notice-headline">
          ${examsPast
            ? `<span class="filled">IB EXAMS</span><span>COMPLETE</span>`
            : `<span class="filled">IB EXAMS IN</span><span>${daysLeft}</span><span>DAYS</span>`}
        </div>
        <div class="notice-progress"><div class="notice-progress-fill" style="width:${yearPct}%"></div></div>
        <div class="notice-footer">
          <span>IB DIPLOMA — ${YEAR_LABEL}</span>
          <span>YEAR ${yearPct}% ELAPSED</span>
          <span>${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}</span>
        </div>
      </div>
    </div>`;
}

// ============================================================
// ASSIGNMENTS
// ============================================================
let assignmentViewMode = 'table';
let filterSubject = '', filterStatus = 'ACTIVE', filterPriority = '';
let sortField = 'deadline', sortDir = 'asc';

const PRIORITY_ORDER = { HIGH: 0, NORMAL: 1, LOW: 2 };
const STATUS_ORDER   = { BLOCKED: 0, IN_PROGRESS: 1, TODO: 2, DONE: 3 };

function initAssignments() {
  const container = document.querySelector('main [data-view="assignments"]');
  if (!container) return;

  container.innerHTML = `
    <div class="view-toolbar">
      <div class="view-toggle">
        <button id="btn-assign-table" class="toggle-btn view-active">TABLE</button>
        <button id="btn-assign-board" class="toggle-btn">BOARD</button>
      </div>
      <div class="filter-bar">
        <select id="filter-subject" class="filter-select">
          <option value="">ALL SUBJECTS</option>
          ${SUBJECTS.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
        </select>
        <select id="filter-astatus" class="filter-select">
          <option value="ACTIVE">ACTIVE (not done)</option>
          <option value="">ALL STATUS</option>
          ${STATUS.map(s => `<option value="${esc(s)}">${fmtStatus(s)}</option>`).join('')}
        </select>
        <select id="filter-apriority" class="filter-select">
          <option value="">ALL PRIORITY</option>
          ${PRIORITY.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
        </select>
        <select id="sort-field" class="filter-select">
          <option value="deadline">SORT: DEADLINE</option>
          <option value="priority">SORT: PRIORITY</option>
          <option value="status">SORT: STATUS</option>
          <option value="subject">SORT: SUBJECT</option>
          <option value="title">SORT: TITLE</option>
          <option value="updatedAt">SORT: UPDATED</option>
        </select>
        <select id="sort-dir" class="filter-select">
          <option value="asc">ASC ↑</option>
          <option value="desc">DESC ↓</option>
        </select>
      </div>
      <button id="btn-new-task" class="action-btn">+ NEW TASK</button>
      <button id="btn-sync-notion" class="action-btn ghost">⟳ SYNC NOTION</button>
      <span id="sync-status" class="mono-label sync-label"></span>
    </div>
    <div id="task-table-container"></div>
    <div id="task-board-container" class="board-container" style="display:none"></div>`;

  document.getElementById('btn-assign-table').addEventListener('click', () => {
    assignmentViewMode = 'table'; renderAssignments();
  });
  document.getElementById('btn-assign-board').addEventListener('click', () => {
    assignmentViewMode = 'board'; renderAssignments();
  });
  document.getElementById('filter-subject').addEventListener('change', e => { filterSubject = e.target.value; renderAssignments(); });
  document.getElementById('filter-astatus').addEventListener('change', e => { filterStatus = e.target.value; renderAssignments(); });
  document.getElementById('filter-apriority').addEventListener('change', e => { filterPriority = e.target.value; renderAssignments(); });
  document.getElementById('sort-field').addEventListener('change', e => { sortField = e.target.value; renderAssignments(); });
  document.getElementById('sort-dir').addEventListener('change', e => { sortDir = e.target.value; renderAssignments(); });
  document.getElementById('btn-new-task').addEventListener('click', openNewTaskModal);
  document.getElementById('btn-sync-notion').addEventListener('click', syncAssignmentsWithNotion);

  // Auto-sync on first load when there's no local data yet
  if (tasks.length === 0) syncAssignmentsWithNotion();
}

function filteredTasks() {
  let list = tasks;
  if (filterSubject)             list = list.filter(t => t.subject === filterSubject);
  if (filterStatus === 'ACTIVE') list = list.filter(t => t.status !== 'DONE');
  else if (filterStatus)         list = list.filter(t => t.status === filterStatus);
  if (filterPriority)            list = list.filter(t => t.priority === filterPriority);

  return [...list].sort((a, b) => {
    let va, vb;
    if (sortField === 'deadline') {
      va = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      vb = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    } else if (sortField === 'priority') {
      va = PRIORITY_ORDER[a.priority] ?? 99;
      vb = PRIORITY_ORDER[b.priority] ?? 99;
    } else if (sortField === 'status') {
      va = STATUS_ORDER[a.status] ?? 99;
      vb = STATUS_ORDER[b.status] ?? 99;
    } else if (sortField === 'updatedAt') {
      va = new Date(a.updatedAt).getTime();
      vb = new Date(b.updatedAt).getTime();
    } else {
      va = (a[sortField] || '').toLowerCase();
      vb = (b[sortField] || '').toLowerCase();
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderAssignments() {
  const tableBtn = document.getElementById('btn-assign-table');
  const boardBtn = document.getElementById('btn-assign-board');
  if (!tableBtn) return;
  tableBtn.classList.toggle('view-active', assignmentViewMode === 'table');
  boardBtn.classList.toggle('view-active', assignmentViewMode === 'board');

  // Sync filter dropdowns
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  setVal('filter-subject', filterSubject);
  setVal('filter-astatus', filterStatus);
  setVal('filter-apriority', filterPriority);
  setVal('sort-field', sortField);
  setVal('sort-dir', sortDir);

  const list = filteredTasks();
  const tableContainer = document.getElementById('task-table-container');
  const boardContainer = document.getElementById('task-board-container');

  if (assignmentViewMode === 'table') {
    tableContainer.style.display = '';
    boardContainer.style.display = 'none';
    renderAssignmentTable(list, tableContainer);
  } else {
    tableContainer.style.display = 'none';
    boardContainer.style.display = '';
    renderAssignmentBoard(list, boardContainer);
  }
}

function renderAssignmentTable(list, container) {
  const cols = '12px 1fr 150px 90px 80px 110px 70px';
  container.innerHTML = `
    <div class="task-row table-header" style="grid-template-columns:${cols}">
      <div></div>
      <div class="mono-label">TITLE</div>
      <div class="mono-label">SUBJECT</div>
      <div class="mono-label">DEADLINE</div>
      <div class="mono-label">DAYS</div>
      <div class="mono-label">STATUS</div>
      <div></div>
    </div>
    ${list.length ? list.map(t => {
      const days = daysUntil(t.deadline);
      const overdue = days !== null && days < 0 && t.status !== 'DONE';
      const daysDisplay = days === null ? '—'
        : overdue ? `<span class="due-chip chip-danger">${Math.abs(days)}d OVER</span>`
        : `<span class="due-chip">${days}d</span>`;
      return `<div class="task-row assign-row ${overdue ? 'overdue-row' : ''}" data-id="${t.id}" style="grid-template-columns:${cols}">
        <div class="priority-dot p-dot-${t.priority} clickable-task-priority" data-id="${t.id}" title="Click to cycle priority (${t.priority})" style="cursor:pointer"></div>
        <div class="task-title">${esc(t.title)}
          ${t.notes ? `<span class="due-chip" title="${esc(t.notes)}">NOTE</span>` : ''}
          ${t.managebacUrl ? `<a href="${esc(t.managebacUrl)}" target="_blank" rel="noopener" class="due-chip chip-link" title="Open in ManageBac">MB ↗</a>` : ''}
        </div>
        <div>${subjectBadge(t.subject)}</div>
        <div class="task-assignee">${fmtDate(t.deadline)}</div>
        <div>${daysDisplay}</div>
        <div class="status-badge s-${t.status} clickable-task-status" data-id="${t.id}" title="Click to cycle status" style="cursor:pointer">${fmtStatus(t.status)}</div>
        <div class="ticket-actions">
          <button class="edit-btn edit-task-btn" data-id="${t.id}" title="Edit">&#x270E;</button>
          <button class="edit-btn delete-task-btn" data-id="${t.id}" title="Delete">&#x2715;</button>
        </div>
      </div>`;
    }).join('') : '<div class="empty-state">No tasks match the current filters.</div>'}`;

  container.querySelectorAll('.edit-task-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditTaskModal(btn.dataset.id); });
  });

  container.querySelectorAll('.delete-task-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      armDelete(btn, '&#x2715;', () => {
        const t = tasks.find(t => t.id === btn.dataset.id);
        if (t?.notionId) archiveNotionTask(t.notionId).catch(err => console.error('Notion delete failed:', err));
        deleteTask(btn.dataset.id);
        renderAndRefreshDash();
      });
    });
  });

  bindTaskCycleClicks(container);
}

const TASK_PRIORITY_CYCLE = ['HIGH', 'NORMAL', 'LOW'];

function bindTaskCycleClicks(container) {
  container.querySelectorAll('.clickable-task-status').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const t = tasks.find(t => t.id === el.dataset.id);
      if (!t) return;
      updateTask(t.id, { status: STATUS[(STATUS.indexOf(t.status) + 1) % STATUS.length] });
      schedulePush('assignments', t.id);
      renderAndRefreshDash();
    });
  });
  container.querySelectorAll('.clickable-task-priority').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const t = tasks.find(t => t.id === el.dataset.id);
      if (!t) return;
      const next = TASK_PRIORITY_CYCLE[(TASK_PRIORITY_CYCLE.indexOf(t.priority) + 1) % TASK_PRIORITY_CYCLE.length];
      updateTask(t.id, { priority: next });
      schedulePush('assignments', t.id);
      renderAndRefreshDash();
    });
  });
}

function renderAssignmentBoard(list, container) {
  container.innerHTML = STATUS.map(col => {
    const colTasks = list.filter(t => t.status === col);
    return `<div class="board-col">
      <div class="board-col-header">
        <span class="status-badge s-${col}">${fmtStatus(col)}</span>
        <span class="mono-label board-col-count">${colTasks.length}</span>
      </div>
      <div class="board-col-cards task-drop-zone" data-col="${col}">
        ${colTasks.map(t => `
          <div class="board-card s-border-${t.status}" draggable="true" data-id="${t.id}">
            <div class="card-title-row">
              <div class="card-title">${esc(t.title)}</div>
            </div>
            <div style="margin-bottom:6px">${subjectBadge(t.subject)}</div>
            <div class="card-meta">
              <span class="priority-badge p-${t.priority} clickable-task-priority" data-id="${t.id}" title="Click to cycle priority" style="cursor:pointer">${t.priority}</span>
              ${dueChip(t.deadline, t.status)}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  bindBoardDrag(container, '.task-drop-zone', (id, col) => {
    updateTask(id, { status: col });
    schedulePush('assignments', id);
    renderAndRefreshDash();
  });

  bindTaskCycleClicks(container);
}

// Shared drag-and-drop wiring for every status board in the app.
function bindBoardDrag(container, zoneSelector, onDrop) {
  container.querySelectorAll('.board-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', card.dataset.id); card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  container.querySelectorAll(zoneSelector).forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      onDrop(e.dataTransfer.getData('text/plain'), zone.dataset.col);
    });
  });
}

function taskFields(t) {
  return [
    { name: 'title',    label: 'TITLE',    type: 'text',     required: true,  defaultValue: t?.title || '' },
    { name: 'subject',  label: 'SUBJECT',  type: 'select',   required: true,  options: SUBJECTS, defaultValue: t?.subject || '' },
    { name: 'type',     label: 'TYPE',     type: 'select',   required: false, options: [{ value: '', label: '— None —' }, ...TASK_TYPES], defaultValue: t?.type || '' },
    { name: 'deadline', label: 'DEADLINE', type: 'date',     required: false, defaultValue: t?.deadline || '' },
    { name: 'priority', label: 'PRIORITY', type: 'select',   required: true,  options: PRIORITY, defaultValue: t?.priority || 'NORMAL' },
    { name: 'status',   label: 'STATUS',   type: 'select',   required: true,  options: STATUS.map(s => ({ value: s, label: fmtStatus(s) })), defaultValue: t?.status || 'TODO' },
    { name: 'notes',    label: 'NOTES',    type: 'textarea', required: false, defaultValue: t?.notes || '' },
    { name: 'body',     label: 'BODY',     type: 'textarea', required: false, defaultValue: t?.body || '' },
  ];
}

function openNewTaskModal() {
  openModal({
    title: 'NEW TASK',
    fields: taskFields(null),
    onSubmit(data) {
      const task = createTask(data);
      schedulePush('assignments', task.id);
      renderAndRefreshDash();
    },
  });
}

function openEditTaskModal(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  openModal({
    title: 'EDIT TASK',
    submitLabel: 'SAVE',
    fields: taskFields(t),
    onSubmit(data) {
      updateTask(id, data);
      schedulePush('assignments', id);
      renderAndRefreshDash();
    },
  });
}

function renderAndRefreshDash() {
  renderAssignments();
  const dashView = document.querySelector('main [data-view="dashboard"]');
  if (dashView && dashView.style.display !== 'none') renderDashboard();
}

// ============================================================
// CODING — two tabs over two Notion databases
// ============================================================
let codingTab = 'projects';
let codingFilterStatus = 'ACTIVE';
let devFilterStatus = 'ACTIVE', devFilterProject = '', devViewMode = 'table';

function renderCoding() {
  const container = document.querySelector('main [data-view="coding"]');
  if (!container) return;

  container.innerHTML = `
    <div class="view-toolbar" style="margin-bottom:0">
      <div class="view-toggle">
        <button class="toggle-btn coding-tab ${codingTab === 'projects' ? 'view-active' : ''}" data-tab="projects">PROJECTS</button>
        <button class="toggle-btn coding-tab ${codingTab === 'tasks' ? 'view-active' : ''}" data-tab="tasks">TASKS</button>
      </div>
      <div class="view-context mono-label" style="margin-left:auto">
        ${codingTab === 'projects' ? 'CODING PROJECTS — DEV LOG' : `CODING TASKS — ${codingTasks.filter(t => t.status !== 'DONE').length} OPEN`}
      </div>
    </div>
    <div id="coding-content" style="margin-top:var(--spacing-md)"></div>`;

  container.querySelectorAll('.coding-tab').forEach(btn => {
    btn.addEventListener('click', () => { codingTab = btn.dataset.tab; renderCoding(); });
  });

  const content = document.getElementById('coding-content');
  if (codingTab === 'projects') renderCodingProjects(content);
  else renderCodingTasks(content);
}

// ── Coding projects ───────────────────────────────────────────────────────

function renderCodingProjects(container) {
  let list = [...coding];
  if (codingFilterStatus === 'ACTIVE') list = list.filter(c => c.status !== 'SHIPPED' && c.status !== 'ARCHIVED');
  else if (codingFilterStatus)         list = list.filter(c => c.status === codingFilterStatus);
  list.sort((a, b) => (b.notionUpdatedAt || '').localeCompare(a.notionUpdatedAt || ''));

  const statusColor = {
    IDEA: '#555', IN_PROGRESS: 'var(--accent)', PAUSED: '#FFB347',
    SHIPPED: 'var(--status-done)', ARCHIVED: '#444',
  };

  container.innerHTML = `
    <div class="view-toolbar">
      <div class="filter-bar">
        <select id="coding-filter-status" class="filter-select">
          <option value="ACTIVE">ACTIVE (not shipped)</option>
          <option value="">ALL STATUS</option>
          ${CODING_STATUSES.map(s => `<option value="${s}">${fmtStatus(s)}</option>`).join('')}
        </select>
      </div>
      <button id="btn-new-coding" class="action-btn">+ NEW PROJECT</button>
      <button id="btn-sync-notion-coding" class="action-btn ghost">⟳ SYNC NOTION</button>
      <span id="sync-status-coding" class="mono-label sync-label"></span>
    </div>

    <div class="project-grid">
      ${list.length ? list.map(c => {
        const open = codingTasks.filter(t => t.projectNotionId === c.notionId && t.status !== 'DONE').length;
        return `<div class="project-card">
          <div class="project-phase-bar">
            <span class="mono-label clickable-coding-status" data-id="${c.id}"
              title="Click to cycle status" style="cursor:pointer;color:${statusColor[c.status] || '#555'}">● ${fmtStatus(c.status)}</span>
            ${c.repoUrl ? `<a href="${esc(c.repoUrl)}" target="_blank" rel="noopener" class="edit-btn" style="text-decoration:none;margin-left:auto" title="Open repo">↗</a>` : ''}
          </div>
          <div class="project-name display-text">${esc(c.name)}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">
            ${c.category ? `<span class="due-chip">${esc(c.category)}</span>` : ''}
            ${chips(c.stack)}
          </div>
          ${c.description ? `<div class="project-desc">${esc(c.description)}</div>` : ''}
          <div class="project-meta">
            <div class="project-stats">
              <span class="mono-label">${open} OPEN TASK${open === 1 ? '' : 'S'}</span>
              ${c.started ? `<span class="mono-label" style="color:#444">/ SINCE ${fmtDate(c.started)}</span>` : ''}
            </div>
            <span class="mono-label" style="color:#444">${c.lastPushed ? 'PUSHED ' + fmtDate(c.lastPushed) : 'NO PUSHES'}</span>
          </div>
          <div class="project-card-actions">
            <span class="mono-label" style="color:#444">${esc(c.type || '')}</span>
            <div class="project-action-btns">
              <button class="edit-btn coding-edit" data-id="${c.id}">&#x270E; EDIT</button>
              <button class="edit-btn coding-del" data-id="${c.id}">&#x2715; DELETE</button>
            </div>
          </div>
        </div>`;
      }).join('')
      : '<div class="empty-state" style="grid-column:1/-1">No coding projects — sync with Notion or create one.</div>'}
    </div>`;

  const filterEl = document.getElementById('coding-filter-status');
  filterEl.value = codingFilterStatus;
  filterEl.addEventListener('change', e => { codingFilterStatus = e.target.value; renderCoding(); });

  document.getElementById('btn-new-coding').addEventListener('click', () => openCodingModal());
  document.getElementById('btn-sync-notion-coding').addEventListener('click', syncCodingWithNotion);

  container.querySelectorAll('.clickable-coding-status').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const c = coding.find(c => c.id === el.dataset.id);
      if (!c) return;
      const next = CODING_STATUSES[(CODING_STATUSES.indexOf(c.status) + 1) % CODING_STATUSES.length];
      updateCoding(c.id, { status: next });
      schedulePush('coding', c.id);
      renderCoding();
    });
  });

  container.querySelectorAll('.coding-edit').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openCodingModal(btn.dataset.id); });
  });

  container.querySelectorAll('.coding-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      armDelete(btn, '&#x2715; DELETE', () => {
        const c = coding.find(c => c.id === btn.dataset.id);
        if (c?.notionId) archiveNotionCoding(c.notionId).catch(err => console.error('Notion archive failed:', err));
        deleteCoding(btn.dataset.id);
        renderCoding();
      });
    });
  });
}

function openCodingModal(id) {
  const c = id ? coding.find(c => c.id === id) : null;
  openModal({
    title: c ? 'EDIT PROJECT' : 'NEW PROJECT',
    submitLabel: c ? 'SAVE' : 'CREATE',
    fields: [
      { name: 'name',        label: 'PROJECT NAME', defaultValue: c?.name || '' },
      { name: 'status',      label: 'STATUS',   type: 'select', options: CODING_STATUSES.map(s => ({ value: s, label: fmtStatus(s) })), defaultValue: c?.status || 'IDEA' },
      { name: 'category',    label: 'CATEGORY', type: 'select', required: false, options: [{ value: '', label: '— None —' }, ...CODING_CATEGORIES], defaultValue: c?.category || '' },
      { name: 'stack',       label: 'STACK',    type: 'multi',  required: false, options: CODING_STACKS, defaultValue: c?.stack || [] },
      { name: 'type',        label: 'TYPE',     type: 'select', required: false, options: [{ value: '', label: '— None —' }, ...CODING_TYPES], defaultValue: c?.type || '' },
      { name: 'description', label: 'DESCRIPTION', type: 'textarea', required: false, defaultValue: c?.description || '' },
      { name: 'repoUrl',     label: 'REPO URL', type: 'url',  required: false, defaultValue: c?.repoUrl || '' },
      { name: 'started',     label: 'STARTED',  type: 'date', required: false, defaultValue: c?.started || '' },
    ],
    onSubmit(data) {
      if (c) {
        updateCoding(id, data);
        schedulePush('coding', id);
      } else {
        schedulePush('coding', createCoding(data).id);
      }
      renderCoding();
    },
  });
}

// ── Coding tasks ──────────────────────────────────────────────────────────

function projectName(notionId) {
  return coding.find(c => c.notionId === notionId)?.name || '';
}

function filteredCodingTasks() {
  let list = [...codingTasks];
  if (devFilterStatus === 'ACTIVE') list = list.filter(t => t.status !== 'DONE');
  else if (devFilterStatus)         list = list.filter(t => t.status === devFilterStatus);
  if (devFilterProject)             list = list.filter(t => t.projectNotionId === devFilterProject);

  // Priority first, then whichever deadlines exist — most dev tasks have none.
  return list.sort((a, b) => {
    const p = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
    if (p !== 0) return p;
    return (a.deadline || '9999').localeCompare(b.deadline || '9999');
  });
}

function renderCodingTasks(container) {
  const list = filteredCodingTasks();
  const projectOptions = coding
    .filter(c => c.notionId)
    .sort((a, b) => a.name.localeCompare(b.name));

  container.innerHTML = `
    <div class="view-toolbar">
      <div class="view-toggle">
        <button id="btn-dev-table" class="toggle-btn ${devViewMode === 'table' ? 'view-active' : ''}">TABLE</button>
        <button id="btn-dev-board" class="toggle-btn ${devViewMode === 'board' ? 'view-active' : ''}">BOARD</button>
      </div>
      <div class="filter-bar">
        <select id="dev-filter-status" class="filter-select">
          <option value="ACTIVE">ACTIVE (not done)</option>
          <option value="">ALL STATUS</option>
          ${STATUS.map(s => `<option value="${s}">${fmtStatus(s)}</option>`).join('')}
        </select>
        <select id="dev-filter-project" class="filter-select">
          <option value="">ALL PROJECTS</option>
          ${projectOptions.map(c => `<option value="${esc(c.notionId)}">${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <button id="btn-new-dev-task" class="action-btn">+ NEW TASK</button>
      <button id="btn-sync-notion-devtasks" class="action-btn ghost">⟳ SYNC NOTION</button>
      <span id="sync-status-devtasks" class="mono-label sync-label"></span>
    </div>
    <div id="dev-task-body"></div>`;

  const statusEl  = document.getElementById('dev-filter-status');
  const projectEl = document.getElementById('dev-filter-project');
  statusEl.value  = devFilterStatus;
  projectEl.value = devFilterProject;
  statusEl.addEventListener('change',  e => { devFilterStatus  = e.target.value; renderCoding(); });
  projectEl.addEventListener('change', e => { devFilterProject = e.target.value; renderCoding(); });

  document.getElementById('btn-dev-table').addEventListener('click', () => { devViewMode = 'table'; renderCoding(); });
  document.getElementById('btn-dev-board').addEventListener('click', () => { devViewMode = 'board'; renderCoding(); });
  document.getElementById('btn-new-dev-task').addEventListener('click', () => openCodingTaskModal());
  document.getElementById('btn-sync-notion-devtasks').addEventListener('click', syncCodingTasksWithNotion);

  const body = document.getElementById('dev-task-body');
  if (devViewMode === 'table') renderCodingTaskTable(list, body);
  else renderCodingTaskBoard(list, body);
}

function renderCodingTaskTable(list, container) {
  const cols = '12px 1fr 160px 90px 110px 70px';
  container.innerHTML = `
    <div class="task-row table-header" style="grid-template-columns:${cols}">
      <div></div>
      <div class="mono-label">TASK</div>
      <div class="mono-label">PROJECT</div>
      <div class="mono-label">DUE</div>
      <div class="mono-label">STATUS</div>
      <div></div>
    </div>
    ${list.length ? list.map(t => {
      const days = daysUntil(t.deadline);
      const overdue = days !== null && days < 0 && t.status !== 'DONE';
      return `<div class="task-row ${overdue ? 'overdue-row' : ''}" data-id="${t.id}" style="grid-template-columns:${cols}">
        <div class="priority-dot p-dot-${t.priority} clickable-dev-priority" data-id="${t.id}" title="Click to cycle priority (${t.priority})" style="cursor:pointer"></div>
        <div class="task-title">${esc(t.title)}
          ${t.notes ? `<span class="due-chip" title="${esc(t.notes)}">NOTE</span>` : ''}
        </div>
        <div class="task-assignee">${esc(projectName(t.projectNotionId) || '—')}</div>
        <div class="task-assignee">${fmtDate(t.deadline)}</div>
        <div class="status-badge s-${t.status} clickable-dev-status" data-id="${t.id}" title="Click to cycle status" style="cursor:pointer">${fmtStatus(t.status)}</div>
        <div class="ticket-actions">
          <button class="edit-btn dev-edit" data-id="${t.id}" title="Edit">&#x270E;</button>
          <button class="edit-btn dev-del" data-id="${t.id}" title="Delete">&#x2715;</button>
        </div>
      </div>`;
    }).join('') : '<div class="empty-state">No dev tasks match the current filters.</div>'}`;

  bindCodingTaskControls(container);
}

function renderCodingTaskBoard(list, container) {
  container.className = 'board-container';
  container.innerHTML = STATUS.map(col => {
    const colTasks = list.filter(t => t.status === col);
    return `<div class="board-col">
      <div class="board-col-header">
        <span class="status-badge s-${col}">${fmtStatus(col)}</span>
        <span class="mono-label board-col-count">${colTasks.length}</span>
      </div>
      <div class="board-col-cards dev-drop-zone" data-col="${col}">
        ${colTasks.map(t => `
          <div class="board-card s-border-${t.status}" draggable="true" data-id="${t.id}">
            <div class="card-title-row">
              <div class="card-title">${esc(t.title)}</div>
              <button class="edit-btn dev-edit" data-id="${t.id}" title="Edit">&#x270E;</button>
            </div>
            ${projectName(t.projectNotionId) ? `<div style="margin-bottom:6px"><span class="due-chip">${esc(projectName(t.projectNotionId))}</span></div>` : ''}
            <div class="card-meta">
              <span class="priority-badge p-${t.priority} clickable-dev-priority" data-id="${t.id}" title="Click to cycle priority" style="cursor:pointer">${t.priority}</span>
              ${dueChip(t.deadline, t.status)}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  bindBoardDrag(container, '.dev-drop-zone', (id, col) => {
    updateCodingTask(id, { status: col });
    schedulePush('codingTasks', id);
    renderCoding();
  });
  bindCodingTaskControls(container);
}

function bindCodingTaskControls(container) {
  container.querySelectorAll('.clickable-dev-status').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const t = codingTasks.find(t => t.id === el.dataset.id);
      if (!t) return;
      updateCodingTask(t.id, { status: STATUS[(STATUS.indexOf(t.status) + 1) % STATUS.length] });
      schedulePush('codingTasks', t.id);
      renderCoding();
    });
  });
  container.querySelectorAll('.clickable-dev-priority').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const t = codingTasks.find(t => t.id === el.dataset.id);
      if (!t) return;
      const next = TASK_PRIORITY_CYCLE[(TASK_PRIORITY_CYCLE.indexOf(t.priority) + 1) % TASK_PRIORITY_CYCLE.length];
      updateCodingTask(t.id, { priority: next });
      schedulePush('codingTasks', t.id);
      renderCoding();
    });
  });
  container.querySelectorAll('.dev-edit').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openCodingTaskModal(btn.dataset.id); });
  });
  container.querySelectorAll('.dev-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      armDelete(btn, '&#x2715;', () => {
        const t = codingTasks.find(t => t.id === btn.dataset.id);
        if (t?.notionId) archiveNotionCodingTask(t.notionId).catch(err => console.error('Notion archive failed:', err));
        deleteCodingTask(btn.dataset.id);
        renderCoding();
      });
    });
  });
}

function openCodingTaskModal(id) {
  const t = id ? codingTasks.find(t => t.id === id) : null;
  const projectOptions = [
    { value: '', label: '— None (learning goal / no repo) —' },
    ...coding.filter(c => c.notionId).sort((a, b) => a.name.localeCompare(b.name))
      .map(c => ({ value: c.notionId, label: c.name })),
  ];
  openModal({
    title: t ? 'EDIT DEV TASK' : 'NEW DEV TASK',
    submitLabel: t ? 'SAVE' : 'CREATE',
    fields: [
      { name: 'title',           label: 'TASK',     defaultValue: t?.title || '' },
      { name: 'projectNotionId', label: 'PROJECT',  type: 'select', required: false, options: projectOptions, defaultValue: t?.projectNotionId || '' },
      { name: 'status',          label: 'STATUS',   type: 'select', options: STATUS.map(s => ({ value: s, label: fmtStatus(s) })), defaultValue: t?.status || 'TODO' },
      { name: 'priority',        label: 'PRIORITY', type: 'select', options: PRIORITY, defaultValue: t?.priority || 'NORMAL' },
      { name: 'deadline',        label: 'DUE (optional)', type: 'date', required: false, defaultValue: t?.deadline || '' },
      { name: 'notes',           label: 'NOTES',    type: 'textarea', required: false, defaultValue: t?.notes || '' },
    ],
    onSubmit(data) {
      if (t) {
        updateCodingTask(id, data);
        schedulePush('codingTasks', id);
      } else {
        schedulePush('codingTasks', createCodingTask(data).id);
      }
      renderCoding();
    },
  });
}

// ============================================================
// GREEK PORTFOLIO
// One card per Notion portfolio entry.
// ============================================================
let greekFilterText = '', greekFilterAssessment = '', greekFilterStatus = '';

// The portfolio DB says "Not Started" where the rest of the app says "To Do".
// Same three states, so only the label differs.
const GREEK_STATUS_LABELS = { TODO: 'NOT STARTED', IN_PROGRESS: 'IN PROGRESS', DONE: 'DONE' };

function renderGreekPortfolio() {
  const container = document.querySelector('main [data-view="greek-portfolio"]');
  if (!container) return;

  let list = [...greek];
  if (greekFilterText)       list = list.filter(e => (e.texts || []).includes(greekFilterText));
  if (greekFilterAssessment) list = list.filter(e => (e.assessment || []).includes(greekFilterAssessment));
  if (greekFilterStatus)     list = list.filter(e => e.status === greekFilterStatus);
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const doneCount = greek.filter(e => e.status === 'DONE').length;
  const onMB      = greek.filter(e => e.onManageBac).length;
  const pct       = greek.length ? Math.round((doneCount / greek.length) * 100) : 0;

  container.innerHTML = `
    <div class="view-toolbar">
      <div class="view-context mono-label">MODERN GREEK A SL — PORTFOLIO</div>
      <div class="filter-bar">
        <select id="greek-filter-text" class="filter-select">
          <option value="">ALL TEXTS</option>
          ${GREEK_TEXTS.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
        </select>
        <select id="greek-filter-assessment" class="filter-select">
          <option value="">ALL ASSESSMENTS</option>
          ${GREEK_ASSESSMENT.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}
        </select>
        <select id="greek-filter-status" class="filter-select">
          <option value="">ALL STATUS</option>
          ${GREEK_STATUSES.map(s => `<option value="${s}">${fmtStatus(s)}</option>`).join('')}
        </select>
      </div>
      <button id="btn-new-greek" class="action-btn">+ NEW ENTRY</button>
      <button id="btn-sync-notion-greek" class="action-btn ghost">⟳ SYNC NOTION</button>
      <span id="sync-status-greek" class="mono-label sync-label"></span>
    </div>

    <div class="greek-top">
      <div class="data-section">
        <span class="panel-label mono-label">PORTFOLIO PROGRESS</span>
        <div class="greek-progress-num display-text">${doneCount}<span>/${greek.length}</span></div>
        <div class="notice-progress"><div class="notice-progress-fill" style="width:${pct}%"></div></div>
        <span class="mono-label panel-foot">ENTRIES COMPLETE</span>
      </div>
      <div class="data-section">
        <span class="panel-label mono-label">ON MANAGEBAC</span>
        <div class="greek-progress-num display-text">${onMB}<span>/${greek.length}</span></div>
        <div class="notice-progress"><div class="notice-progress-fill" style="width:${greek.length ? Math.round((onMB / greek.length) * 100) : 0}%"></div></div>
        <span class="mono-label panel-foot">ENTRIES SUBMITTED</span>
      </div>
    </div>

    <div class="greek-grid">
      ${list.length ? list.map((e, i) => `
        <div class="greek-card seg-border-${e.status}">
          <div class="greek-card-head">
            <span class="greek-card-index display-text">${String(i + 1).padStart(2, '0')}</span>
            <span class="mono-label" style="color:var(--ink-3)">${fmtDate(e.date)}</span>
          </div>
          <div class="greek-card-title">${esc(e.title)}</div>
          <div class="greek-stepper">
            ${GREEK_STATUSES.map(s => `
              <button class="greek-status-step ${e.status === s ? 'step-active' : ''}"
                data-id="${e.id}" data-status="${s}">${GREEK_STATUS_LABELS[s]}</button>`).join('')}
          </div>
          <div class="greek-chip-rows">
            ${e.texts?.length      ? `<div class="greek-chip-row"><span class="mono-label">TEXT</span>${chips(e.texts)}</div>` : ''}
            ${e.assessment?.length ? `<div class="greek-chip-row"><span class="mono-label">ASSESS</span>${chips(e.assessment)}</div>` : ''}
            ${e.concepts?.length   ? `<div class="greek-chip-row"><span class="mono-label">CONCEPT</span>${chips(e.concepts)}</div>` : ''}
            ${e.areas?.length      ? `<div class="greek-chip-row"><span class="mono-label">AREA</span>${chips(e.areas)}</div>` : ''}
            ${e.skills?.length     ? `<div class="greek-chip-row"><span class="mono-label">SKILL</span>${chips(e.skills)}</div>` : ''}
          </div>
          <div class="greek-card-foot">
            <button class="edit-btn greek-mb-toggle ${e.onManageBac ? 'mb-on' : ''}" data-id="${e.id}"
              title="Toggle ManageBac submission">${e.onManageBac ? '✓ ON MANAGEBAC' : 'NOT ON MANAGEBAC'}</button>
            <div class="project-action-btns">
              <button class="edit-btn greek-edit" data-id="${e.id}">&#x270E; EDIT</button>
              <button class="edit-btn greek-del" data-id="${e.id}">&#x2715;</button>
            </div>
          </div>
        </div>`).join('')
      : '<div class="empty-state" style="grid-column:1/-1">No entries match the current filters — sync with Notion or add one.</div>'}
    </div>`;

  const textEl   = document.getElementById('greek-filter-text');
  const assessEl = document.getElementById('greek-filter-assessment');
  const statusEl = document.getElementById('greek-filter-status');
  textEl.value   = greekFilterText;
  assessEl.value = greekFilterAssessment;
  statusEl.value = greekFilterStatus;
  textEl.addEventListener('change',   e => { greekFilterText       = e.target.value; renderGreekPortfolio(); });
  assessEl.addEventListener('change', e => { greekFilterAssessment = e.target.value; renderGreekPortfolio(); });
  statusEl.addEventListener('change', e => { greekFilterStatus     = e.target.value; renderGreekPortfolio(); });

  document.getElementById('btn-new-greek').addEventListener('click', () => openGreekModal());
  document.getElementById('btn-sync-notion-greek').addEventListener('click', syncGreekWithNotion);

  container.querySelectorAll('.greek-status-step').forEach(btn => {
    btn.addEventListener('click', () => {
      updateGreekEntry(btn.dataset.id, { status: btn.dataset.status });
      schedulePush('greek', btn.dataset.id);
      renderGreekPortfolio();
    });
  });

  container.querySelectorAll('.greek-mb-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const e = greek.find(e => e.id === btn.dataset.id);
      if (!e) return;
      updateGreekEntry(e.id, { onManageBac: !e.onManageBac });
      schedulePush('greek', e.id);
      renderGreekPortfolio();
    });
  });

  container.querySelectorAll('.greek-edit').forEach(btn => {
    btn.addEventListener('click', () => openGreekModal(btn.dataset.id));
  });

  container.querySelectorAll('.greek-del').forEach(btn => {
    btn.addEventListener('click', () => {
      armDelete(btn, '&#x2715;', () => {
        const e = greek.find(e => e.id === btn.dataset.id);
        if (e?.notionId) archiveNotionText(e.notionId).catch(err => console.error('Notion archive failed:', err));
        deleteGreekEntry(btn.dataset.id);
        renderGreekPortfolio();
      });
    });
  });
}

function openGreekModal(id) {
  const e = id ? greek.find(e => e.id === id) : null;
  openModal({
    title: e ? 'EDIT ENTRY' : 'NEW ENTRY',
    submitLabel: e ? 'SAVE' : 'CREATE',
    fields: [
      { name: 'title',       label: 'TITLE',  defaultValue: e?.title || '' },
      { name: 'status',      label: 'STATUS', type: 'select', options: GREEK_STATUSES.map(s => ({ value: s, label: fmtStatus(s) })), defaultValue: e?.status || 'TODO' },
      { name: 'date',        label: 'DATE',   type: 'date', required: false, defaultValue: e?.date || '' },
      { name: 'texts',       label: 'TEXT / WORK / NOVEL',  type: 'multi', required: false, options: GREEK_TEXTS,      defaultValue: e?.texts || [] },
      { name: 'assessment',  label: 'ASSESSMENT',           type: 'multi', required: false, options: GREEK_ASSESSMENT, defaultValue: e?.assessment || [] },
      { name: 'areas',       label: 'AREAS OF EXPLORATION', type: 'multi', required: false, options: GREEK_AREAS,      defaultValue: e?.areas || [] },
      { name: 'concepts',    label: 'CONCEPTS',             type: 'multi', required: false, options: GREEK_CONCEPTS,   defaultValue: e?.concepts || [] },
      { name: 'fields',      label: 'FIELDS OF INQUIRY',    type: 'multi', required: false, options: GREEK_FIELDS,     defaultValue: e?.fields || [] },
      { name: 'readingLog',  label: 'READING LOG',          type: 'multi', required: false, options: GREEK_READING,    defaultValue: e?.readingLog || [] },
      { name: 'skills',      label: 'SKILLS',               type: 'multi', required: false, options: GREEK_SKILLS,     defaultValue: e?.skills || [] },
      { name: 'onManageBac', label: 'ON MANAGEBAC',         type: 'checkbox', required: false, defaultValue: !!e?.onManageBac },
    ],
    onSubmit(data) {
      if (e) {
        updateGreekEntry(id, data);
        schedulePush('greek', id);
      } else {
        schedulePush('greek', createGreekEntry(data).id);
      }
      renderGreekPortfolio();
    },
  });
}

// ============================================================
// SIDE QUESTS
// A record of things that happened. Not a task board.
// ============================================================
let questFilterStatus = '', questFilterCategory = '', questFilterYear = '';

function renderSideQuests() {
  const container = document.querySelector('main [data-view="side-quests"]');
  if (!container) return;

  let list = [...quests];
  if (questFilterStatus)   list = list.filter(q => q.status === questFilterStatus);
  if (questFilterCategory) list = list.filter(q => (q.category || []).includes(questFilterCategory));
  if (questFilterYear)     list = list.filter(q => q.schoolYear === questFilterYear);
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const statusColor = { ONGOING: 'var(--accent)', DONE: 'var(--status-done)', DROPPED: '#555' };

  container.innerHTML = `
    <div class="view-toolbar">
      <div class="view-context mono-label">SIDE QUESTS — ${quests.filter(q => q.status === 'ONGOING').length} ONGOING / ${quests.length} LOGGED</div>
      <div class="filter-bar">
        <select id="quest-filter-status" class="filter-select">
          <option value="">ALL STATUS</option>
          ${SIDE_QUEST_STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <select id="quest-filter-category" class="filter-select">
          <option value="">ALL CATEGORIES</option>
          ${SIDE_QUEST_CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
        </select>
        <select id="quest-filter-year" class="filter-select">
          <option value="">ALL YEARS</option>
          ${SCHOOL_YEARS.map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join('')}
        </select>
      </div>
      <button id="btn-new-quest" class="action-btn">+ NEW QUEST</button>
      <button id="btn-sync-notion-quests" class="action-btn ghost">⟳ SYNC NOTION</button>
      <span id="sync-status-quests" class="mono-label sync-label"></span>
    </div>

    <div class="project-grid">
      ${list.length ? list.map(q => `
        <div class="project-card">
          <div class="project-phase-bar">
            <span class="mono-label clickable-quest-status" data-id="${q.id}"
              title="Click to cycle status" style="cursor:pointer;color:${statusColor[q.status] || '#555'}">● ${q.status}</span>
            ${q.link ? `<a href="${esc(q.link)}" target="_blank" rel="noopener" class="edit-btn" style="text-decoration:none;margin-left:auto" title="Open link">↗</a>` : ''}
          </div>
          <div class="project-name display-text">${esc(q.name)}</div>
          ${q.role ? `<div class="project-desc"><span class="mono-label" style="color:#555">ROLE: </span>${esc(q.role)}</div>` : ''}
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">
            ${chips(q.category)}
            ${chips(q.businessVenture)}
          </div>
          ${q.outcome ? `<div class="project-desc"><span class="mono-label" style="color:#555">OUTCOME: </span>${esc(q.outcome)}</div>` : ''}
          ${q.notes   ? `<div class="project-desc">${esc(q.notes)}</div>` : ''}
          <div class="project-meta">
            <div class="project-stats">
              <span class="mono-label">${q.schoolYear || '—'}</span>
            </div>
            <span class="mono-label" style="color:#444">${q.date ? fmtDate(q.date) : 'NO DATE'}</span>
          </div>
          <div class="project-card-actions">
            <span class="mono-label" style="color:#444"></span>
            <div class="project-action-btns">
              <button class="edit-btn quest-edit" data-id="${q.id}">&#x270E; EDIT</button>
              <button class="edit-btn quest-del" data-id="${q.id}">&#x2715; DELETE</button>
            </div>
          </div>
        </div>`).join('')
      : '<div class="empty-state" style="grid-column:1/-1">No side quests match the current filters.</div>'}
    </div>`;

  const statusEl = document.getElementById('quest-filter-status');
  const catEl    = document.getElementById('quest-filter-category');
  const yearEl   = document.getElementById('quest-filter-year');
  statusEl.value = questFilterStatus;
  catEl.value    = questFilterCategory;
  yearEl.value   = questFilterYear;
  statusEl.addEventListener('change', e => { questFilterStatus   = e.target.value; renderSideQuests(); });
  catEl.addEventListener('change',    e => { questFilterCategory = e.target.value; renderSideQuests(); });
  yearEl.addEventListener('change',   e => { questFilterYear     = e.target.value; renderSideQuests(); });

  document.getElementById('btn-new-quest').addEventListener('click', () => openQuestModal());
  document.getElementById('btn-sync-notion-quests').addEventListener('click', syncQuestsWithNotion);

  container.querySelectorAll('.clickable-quest-status').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const q = quests.find(q => q.id === el.dataset.id);
      if (!q) return;
      const next = SIDE_QUEST_STATUSES[(SIDE_QUEST_STATUSES.indexOf(q.status) + 1) % SIDE_QUEST_STATUSES.length];
      updateQuest(q.id, { status: next });
      schedulePush('quests', q.id);
      renderSideQuests();
    });
  });

  container.querySelectorAll('.quest-edit').forEach(btn => {
    btn.addEventListener('click', () => openQuestModal(btn.dataset.id));
  });

  container.querySelectorAll('.quest-del').forEach(btn => {
    btn.addEventListener('click', () => {
      armDelete(btn, '&#x2715; DELETE', () => {
        const q = quests.find(q => q.id === btn.dataset.id);
        if (q?.notionId) archiveNotionProject(q.notionId).catch(err => console.error('Notion archive failed:', err));
        deleteQuest(btn.dataset.id);
        renderSideQuests();
      });
    });
  });
}

function openQuestModal(id) {
  const q = id ? quests.find(q => q.id === id) : null;
  openModal({
    title: q ? 'EDIT QUEST' : 'NEW QUEST',
    submitLabel: q ? 'SAVE' : 'CREATE',
    fields: [
      { name: 'name',       label: 'NAME',        defaultValue: q?.name || '' },
      { name: 'status',     label: 'STATUS',      type: 'select', options: SIDE_QUEST_STATUSES, defaultValue: q?.status || 'ONGOING' },
      { name: 'date',       label: 'DATE',        type: 'date', required: false, defaultValue: q?.date || '' },
      { name: 'schoolYear', label: 'SCHOOL YEAR', type: 'select', required: false, options: [{ value: '', label: '— None —' }, ...SCHOOL_YEARS], defaultValue: q?.schoolYear || '' },
      { name: 'role',       label: 'ROLE',        required: false, defaultValue: q?.role || '' },
      { name: 'category',   label: 'CATEGORY',    type: 'multi', required: false, options: SIDE_QUEST_CATEGORIES, defaultValue: q?.category || [] },
      { name: 'outcome',    label: 'OUTCOME',     type: 'textarea', required: false, defaultValue: q?.outcome || '' },
      { name: 'notes',      label: 'NOTES',       type: 'textarea', required: false, defaultValue: q?.notes || '' },
      { name: 'link',       label: 'LINK',        type: 'url', required: false, defaultValue: q?.link || '' },
    ],
    onSubmit(data) {
      if (q) {
        updateQuest(id, data);
        schedulePush('quests', id);
      } else {
        schedulePush('quests', createQuest(data).id);
      }
      renderSideQuests();
    },
  });
}

// ============================================================
// NOTION SYNC
// Each view pushes edits on a debounce and pulls on demand.
// ============================================================
const SYNC_VIEWS = {
  assignments: {
    btn: 'btn-sync-notion',           lbl: 'sync-status',
    list: () => tasks,                setList: setTasks,
    fetchAll: fetchAllNotionTasks,    fromPage: fromNotionPage,
    create: createNotionTask,         update: updateNotionTask,
    idPrefix: 'task',                 render: () => renderAndRefreshDash(),
  },
  quests: {
    btn: 'btn-sync-notion-quests',    lbl: 'sync-status-quests',
    list: () => quests,               setList: setQuests,
    fetchAll: fetchAllNotionProjects, fromPage: fromNotionProject,
    create: createNotionProject,      update: updateNotionProject,
    idPrefix: 'quest',                render: () => renderSideQuests(),
  },
  coding: {
    btn: 'btn-sync-notion-coding',    lbl: 'sync-status-coding',
    list: () => coding,               setList: setCoding,
    fetchAll: fetchAllNotionCoding,   fromPage: fromNotionCoding,
    create: createNotionCoding,       update: updateNotionCoding,
    idPrefix: 'code',                 render: () => renderCoding(),
  },
  codingTasks: {
    btn: 'btn-sync-notion-devtasks',      lbl: 'sync-status-devtasks',
    list: () => codingTasks,              setList: setCodingTasks,
    fetchAll: fetchAllNotionCodingTasks,  fromPage: fromNotionCodingTask,
    create: createNotionCodingTask,       update: updateNotionCodingTask,
    idPrefix: 'ctask',                    render: () => renderCoding(),
  },
  greek: {
    btn: 'btn-sync-notion-greek',     lbl: 'sync-status-greek',
    list: () => greek,                setList: setGreek,
    fetchAll: fetchAllNotionTexts,    fromPage: fromNotionText,
    create: createNotionText,         update: updateNotionText,
    idPrefix: 'grk',                  render: () => renderGreekPortfolio(),
  },
};

const pendingPush = {};
const pushTimers  = {};

function schedulePush(viewKey, itemId) {
  (pendingPush[viewKey] ??= new Set()).add(itemId);
  clearTimeout(pushTimers[viewKey]);
  pushTimers[viewKey] = setTimeout(() => flushPush(viewKey), 2000);
}

function setSyncStatus(viewKey, state, msg = '') {
  const btnEl = document.getElementById(SYNC_VIEWS[viewKey].btn);
  const lblEl = document.getElementById(SYNC_VIEWS[viewKey].lbl);
  if (!btnEl || !lblEl) return;
  const states = {
    idle:    { text: '⟳ SYNC NOTION', color: '#555',                   label: '' },
    syncing: { text: '⟳ SYNCING…',    color: 'var(--accent)',          label: 'WORKING…' },
    success: { text: '⟳ SYNC NOTION', color: 'var(--status-done)',     label: '✓ SYNCED' },
    error:   { text: '⟳ SYNC NOTION', color: 'var(--status-blocked)',  label: '✗ ' + msg },
  };
  const s = states[state] || states.idle;
  btnEl.textContent       = s.text;
  btnEl.style.color       = s.color;
  btnEl.style.borderColor = s.color;
  lblEl.textContent       = s.label;
  lblEl.style.color       = s.color;
}

// Push everything edited since the last flush. Assignments also carry a page body.
async function flushPush(viewKey) {
  const cfg = SYNC_VIEWS[viewKey];
  const ids = [...(pendingPush[viewKey] || [])];
  if (!ids.length) return;
  pendingPush[viewKey].clear();
  clearTimeout(pushTimers[viewKey]);
  setSyncStatus(viewKey, 'syncing');
  try {
    for (const id of ids) {
      const item = cfg.list().find(x => x.id === id);
      if (!item) continue;
      if (item.notionId) {
        await cfg.update(item.notionId, item);
        if (viewKey === 'assignments' && item.body?.trim()) {
          await updatePageBody(item.notionId, item.body).catch(err => console.error('Body push failed:', err));
        }
      } else {
        const page = await cfg.create(item);
        if (page?.id) {
          cfg.setList(cfg.list().map(x => x.id === id ? { ...x, notionId: page.id } : x));
          if (viewKey === 'assignments' && item.body?.trim()) {
            await updatePageBody(page.id, item.body).catch(err => console.error('Body push failed:', err));
          }
        }
      }
    }
    setSyncStatus(viewKey, 'success');
    setTimeout(() => setSyncStatus(viewKey, 'idle'), 2000);
  } catch (err) {
    console.error(`${viewKey} push failed:`, err);
    setSyncStatus(viewKey, 'error', err.message);
  }
}

// Pull from Notion and merge, last write wins. Pending local edits are pushed
// first, otherwise a sync fired inside the 2s debounce would overwrite them.
async function syncView(viewKey) {
  const cfg = SYNC_VIEWS[viewKey];
  await flushPush(viewKey);
  setSyncStatus(viewKey, 'syncing');
  try {
    const pages = await cfg.fetchAll();
    const localByNotionId = Object.fromEntries(
      cfg.list().filter(x => x.notionId).map(x => [x.notionId, x])
    );
    let merged = [...cfg.list()];

    for (const page of pages) {
      const remote = cfg.fromPage(page);
      const local  = localByNotionId[page.id];
      if (local) {
        const remoteTime = new Date(remote.notionUpdatedAt);
        const localTime  = new Date(local.notionUpdatedAt || 0);
        if (remoteTime >= localTime) {
          merged = merged.map(x => x.id === local.id ? { ...x, ...remote, id: x.id } : x);
        } else {
          await cfg.update(page.id, local);
        }
      } else {
        merged = [...merged, { id: generateId(cfg.idPrefix), ...remote }];
      }
    }

    // Anything created locally and never pushed
    for (const item of merged.filter(x => !x.notionId)) {
      const page = await cfg.create(item);
      merged = merged.map(x => x.id === item.id ? { ...x, notionId: page.id } : x);
    }

    cfg.setList(merged);
    setSyncStatus(viewKey, 'success');
    setTimeout(() => setSyncStatus(viewKey, 'idle'), 3000);
    cfg.render();
  } catch (err) {
    console.error(`${viewKey} sync failed:`, err);
    setSyncStatus(viewKey, 'error', err.message);
  }
}

const syncQuestsWithNotion      = () => syncView('quests');
const syncCodingWithNotion      = () => syncView('coding');
const syncCodingTasksWithNotion = () => syncView('codingTasks');
const syncGreekWithNotion       = () => syncView('greek');

// Assignments carry a page body and a done-task cutoff, so they get their own pull.
async function syncAssignmentsWithNotion() {
  await flushPush('assignments');
  setSyncStatus('assignments', 'syncing');
  try {
    const pages = await fetchAllNotionTasks();
    const localByNotionId = Object.fromEntries(tasks.filter(t => t.notionId).map(t => [t.notionId, t]));
    let merged = [...tasks];

    for (const page of pages) {
      const remote = fromNotionPage(page);
      const local  = localByNotionId[page.id];

      if (local) {
        const remoteTime = new Date(page.last_edited_time);
        const localTime  = new Date(local.updatedAt);
        if (remoteTime >= localTime) {
          // Bodies are only worth fetching for work still in flight
          const body = remote.status !== 'DONE' ? await fetchPageBody(page.id) : (local.body || '');
          merged = merged.map(t => t.id === local.id ? { ...t, ...remote, body, id: t.id, createdAt: t.createdAt } : t);
        } else {
          await updateNotionTask(page.id, local);
          if (local.status !== 'DONE') await updatePageBody(page.id, local.body || '');
        }
      } else {
        const body = remote.status !== 'DONE' ? await fetchPageBody(page.id) : '';
        merged = [...merged, {
          id:        generateId('task'),
          createdAt: page.created_time,
          updatedAt: page.last_edited_time,
          body,
          ...remote,
        }];
      }
    }

    for (const task of merged.filter(t => !t.notionId)) {
      const page = await createNotionTask(task);
      merged = merged.map(t => t.id === task.id ? { ...t, notionId: page.id } : t);
      if (task.body?.trim()) {
        await updatePageBody(page.id, task.body).catch(err => console.error('Body push failed:', err));
      }
    }

    // Keep the local store from growing forever: drop DONE tasks after a week.
    const cutoff = Date.now() - 7 * 86400000;
    merged = merged.filter(t => t.status !== 'DONE' || new Date(t.updatedAt).getTime() >= cutoff);

    setTasks(merged);
    setSyncStatus('assignments', 'success');
    setTimeout(() => setSyncStatus('assignments', 'idle'), 3000);
    renderAndRefreshDash();
  } catch (err) {
    console.error('Assignments sync failed:', err);
    setSyncStatus('assignments', 'error', err.message);
  }
}

// ============================================================
// BOOT
// ============================================================
initModal();
initAssignments();

// Coding projects load first so dev tasks can resolve their project relation.
if (coding.length === 0) {
  syncCodingWithNotion().then(() => {
    if (codingTasks.length === 0) syncCodingTasksWithNotion();
  });
} else if (codingTasks.length === 0) {
  syncCodingTasksWithNotion();
}
if (quests.length === 0) syncQuestsWithNotion();
if (greek.length === 0)  syncGreekWithNotion();

registerView('dashboard',       renderDashboard);
registerView('assignments',     renderAssignments);
registerView('coding',          renderCoding);
registerView('greek-portfolio', renderGreekPortfolio);
registerView('side-quests',     renderSideQuests);

document.querySelectorAll('.nav-item[data-view]').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.view));
});

// Meta-grid: week + date
document.getElementById('meta-sprint').textContent = 'W' + getISOWeek();
document.getElementById('meta-date').textContent =
  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Sidebar exam countdown
const examCountdownEl = document.getElementById('sidebar-countdown-num');
if (examCountdownEl) {
  const examDays = Math.ceil((new Date(EXAM_DATE) - new Date()) / 86400000);
  examCountdownEl.textContent = examDays >= 0 ? `T-${examDays}` : 'DONE';
}

initRouter('dashboard');
