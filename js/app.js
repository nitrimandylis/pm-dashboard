// ============================================================
// IMPORTS
// ============================================================
import {
  SUBJECTS, STATUS, PRIORITY, TASK_TYPES, SIDE_QUEST_STATUSES, GREEK_TEXT_STATUSES,
  tasks, createTask, updateTask, deleteTask, setTasks, generateId,
  projects, createProject, updateProject, deleteProject,
  ee, updateEE, addMeeting,
  greek, updateGreek, updateGreekText,
  // PM
  getPMTickets, createPMTicket, updatePMTicket, deletePMTicket,
  getPMTeam, createPMMember, updatePMMember, deletePMMember,
  getPMActiveProject, setPMActiveProject,
} from './data.js';

import {
  fetchAllNotionTasks,
  createNotionTask,
  updateNotionTask,
  archiveNotionTask,
  fetchPageBody,
  updatePageBody,
  fromNotionPage,
  fetchAllNotionProjects, createNotionProject, updateNotionProject, archiveNotionProject, fromNotionProject,
  fetchAllNotionMilestones, createNotionMilestone, updateNotionMilestone, fromNotionMilestone,
  fetchAllNotionTexts, createNotionText, updateNotionText, archiveNotionText, fromNotionText,
} from './notion.js';

// ============================================================
// ROUTER
// ============================================================
const views = {};
let currentView = null;

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
  document.querySelectorAll('main [data-view]').forEach(el => el.style.display = 'none');
  const container = document.querySelector(`main [data-view="${viewId}"]`);
  if (container) container.style.display = '';
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('nav-active', el.dataset.view === viewId);
  });
  currentView = viewId;
  updateMeta(viewId);
  views[viewId]();
}

function initRouter(defaultView) {
  window.addEventListener('hashchange', () => {
    const id = window.location.hash.slice(1) || defaultView;
    activateView(id);
  });
  activateView(window.location.hash.slice(1) || defaultView);
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
    const data = Object.fromEntries(new FormData(e.target));
    onSubmit(data);
    closeModal();
  });
  modalOverlay.classList.add('active');
  modalBox.querySelector('input, select, textarea')?.focus();
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

// ============================================================
// HELPERS
// ============================================================
function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtStatus(s) { return s.replace('_', '\u00A0'); }

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
  return `<span class="subject-badge subj-${subjectSlug(subject)} mono-label">${esc(subject)}</span>`;
}

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getISOWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

const VIEW_TITLES = {
  'dashboard':       'Dashboard',
  'assignments':     'Assignments',
  'ee-tracker':      'EE Tracker',
  'greek-portfolio': 'Greek Portfolio',
  'projects':        'Projects',
};

function updateMeta(viewId) {
  const crumb = document.getElementById('header-breadcrumb');
  if (crumb && viewId) {
    crumb.textContent = 'HOME / ' + viewId.toUpperCase().replace(/-/g, ' ');
  }
  const title = document.getElementById('header-title');
  if (title && viewId) {
    title.textContent = VIEW_TITLES[viewId] || viewId.replace(/-/g, ' ');
  }
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
  const done = tasks.filter(t => t.status === 'DONE');

  // Urgent: overdue or CRITICAL/HIGH due within 7 days
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
  const examDate = new Date('2026-05-05');
  const daysLeft = Math.ceil((examDate - new Date()) / 86400000);
  const examsPast = daysLeft < 0;
  const yearStart = new Date('2025-09-01');
  const yearPct = Math.min(100, Math.max(0,
    Math.round(((Date.now() - yearStart) / (examDate - yearStart)) * 100)
  ));

  // Deadline ticker: everything due within 14 days, soonest first
  const upcoming = notDone
    .filter(t => {
      const d = daysUntil(t.deadline);
      return d !== null && d >= 0 && d <= 14;
    })
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const tickerItems = (upcoming.length ? upcoming.map(t => {
    const d = daysUntil(t.deadline);
    const dLabel = d === 0 ? '<span class="hot">DUE TODAY</span>'
      : d <= 3 ? `<span class="hot">${d}D LEFT</span>`
      : `${d}D LEFT`;
    return `<span class="ticker-item"><span class="sep">&#x25B6;</span>${esc(t.subject)} — ${esc(t.title)} — ${dLabel}</span>`;
  }) : ['<span class="ticker-item"><span class="sep">&#x25B6;</span>NO DEADLINES IN THE NEXT 14 DAYS — CLEAR RUNWAY</span>']).join('');

  const stats = [
    { v: tasks.length,    l: 'TOTAL TASKS',   cls: '' },
    { v: overdue.length,  l: 'OVERDUE',       cls: 'stat-danger' },
    { v: thisWeek.length, l: 'DUE THIS WEEK', cls: 'stat-review' },
    { v: done.length,     l: 'DONE',          cls: 'stat-done' },
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
            const isOverdue = days !== null && days < 0 && t.status !== 'DONE';
            const daysLabel = days === null ? '' : isOverdue
              ? `<span class="due-chip chip-danger">${Math.abs(days)}d OVERDUE</span>`
              : `<span class="due-chip">${days}d LEFT</span>`;
            return `<div class="task-row ${isOverdue ? 'overdue-row' : ''}">
              <div class="task-title">${esc(t.title)} ${daysLabel}</div>
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
          <span>IB DIPLOMA — 2025/26</span>
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
const STATUS_ORDER   = { BLOCKED: 0, IN_PROGRESS: 1, REVIEW: 2, TODO: 3, DONE: 4 };

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
    <div id="task-board-container" class="board-container board-5col" style="display:none"></div>`;

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

  list = [...list].sort((a, b) => {
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

  return list;
}

function renderAssignments() {
  const tableBtn = document.getElementById('btn-assign-table');
  const boardBtn = document.getElementById('btn-assign-board');
  if (!tableBtn) return;
  tableBtn.classList.toggle('view-active', assignmentViewMode === 'table');
  boardBtn.classList.toggle('view-active', assignmentViewMode === 'board');

  // Sync filter dropdowns
  const subj = document.getElementById('filter-subject');
  const stat = document.getElementById('filter-astatus');
  const pri  = document.getElementById('filter-apriority');
  if (subj) subj.value = filterSubject;
  if (stat) stat.value = filterStatus;
  if (pri)  pri.value  = filterPriority;
  const sortFieldEl = document.getElementById('sort-field');
  const sortDirEl   = document.getElementById('sort-dir');
  if (sortFieldEl) sortFieldEl.value = sortField;
  if (sortDirEl)   sortDirEl.value   = sortDir;

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
      if (btn.dataset.confirm) {
        const t = tasks.find(t => t.id === btn.dataset.id);
        if (t?.notionId) archiveNotionTask(t.notionId).catch(err => console.error('Notion delete failed:', err));
        deleteTask(btn.dataset.id);
        renderAndRefreshDash();
      } else {
        btn.dataset.confirm = '1';
        btn.textContent = 'SURE?';
        btn.style.color = 'var(--status-blocked)';
        setTimeout(() => {
          if (btn.dataset.confirm) { btn.dataset.confirm = ''; btn.innerHTML = '&#x2715;'; btn.style.color = ''; }
        }, 3000);
      }
    });
  });

  bindTaskCycleClicks(container);
}

const TASK_STATUS_CYCLE   = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'];
const TASK_PRIORITY_CYCLE = ['HIGH', 'NORMAL', 'LOW'];

function bindTaskCycleClicks(container) {
  container.querySelectorAll('.clickable-task-status').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const t = tasks.find(t => t.id === el.dataset.id);
      if (!t) return;
      const next = TASK_STATUS_CYCLE[(TASK_STATUS_CYCLE.indexOf(t.status) + 1) % TASK_STATUS_CYCLE.length];
      updateTask(el.dataset.id, { status: next });
      schedulePush('assignments', el.dataset.id);
      renderAndRefreshDash();
    });
  });
  container.querySelectorAll('.clickable-task-priority').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const t = tasks.find(t => t.id === el.dataset.id);
      if (!t) return;
      const next = TASK_PRIORITY_CYCLE[(TASK_PRIORITY_CYCLE.indexOf(t.priority) + 1) % TASK_PRIORITY_CYCLE.length];
      updateTask(el.dataset.id, { priority: next });
      schedulePush('assignments', el.dataset.id);
      renderAndRefreshDash();
    });
  });
}

function renderAssignmentBoard(list, container) {
  const COLS = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'];
  container.innerHTML = COLS.map(col => {
    const colTasks = list.filter(t => t.status === col);
    return `<div class="board-col">
      <div class="board-col-header">
        <span class="status-badge s-${col}">${fmtStatus(col)}</span>
        <span class="mono-label board-col-count">${colTasks.length}</span>
      </div>
      <div class="board-col-cards task-drop-zone" data-col="${col}">
        ${colTasks.map(t => {
          const days = daysUntil(t.deadline);
          const isOverdue = days !== null && days < 0 && t.status !== 'DONE';
          const daysChip = days !== null
            ? `<span class="due-chip ${isOverdue ? 'chip-danger' : ''}">${isOverdue ? Math.abs(days) + 'd OVERDUE' : days < 0 ? Math.abs(days) + 'd ago' : days + 'd LEFT'}</span>`
            : '';
          return `<div class="board-card s-border-${t.status}" draggable="true" data-id="${t.id}">
            <div class="card-title-row">
              <div class="card-title">${esc(t.title)}</div>
            </div>
            <div style="margin-bottom:6px">${subjectBadge(t.subject)}</div>
            <div class="card-meta">
              <span class="priority-badge p-${t.priority} clickable-task-priority" data-id="${t.id}" title="Click to cycle priority" style="cursor:pointer">${t.priority}</span>
              ${daysChip}
            </div>
            <div style="margin-top:6px">
              <span class="status-badge s-${t.status} clickable-task-status" data-id="${t.id}" title="Click to cycle status" style="cursor:pointer">${fmtStatus(t.status)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.board-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', card.dataset.id); card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  container.querySelectorAll('.task-drop-zone').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      updateTask(id, { status: zone.dataset.col });
      schedulePush('assignments', id);
      renderAndRefreshDash();
    });
  });

  bindTaskCycleClicks(container);
}

function openNewTaskModal() {
  openModal({
    title: 'NEW TASK',
    fields: [
      { name: 'title',    label: 'TITLE',    type: 'text',     required: true },
      { name: 'subject',  label: 'SUBJECT',  type: 'select',   options: SUBJECTS.map(s => ({ value: s, label: s })), required: true },
      { name: 'type',     label: 'TYPE',     type: 'select',   options: TASK_TYPES.map(t => ({ value: t, label: t })), required: false },
      { name: 'deadline', label: 'DEADLINE', type: 'date',     required: false },
      { name: 'priority', label: 'PRIORITY', type: 'select',   options: PRIORITY.map(p => ({ value: p, label: p })), required: true },
      { name: 'status',   label: 'STATUS',   type: 'select',   options: STATUS.map(s => ({ value: s, label: fmtStatus(s) })), required: true },
      { name: 'notes',    label: 'NOTES',    type: 'textarea', required: false },
      { name: 'body',     label: 'BODY',     type: 'textarea', required: false },
    ],
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
    fields: [
      { name: 'title',    label: 'TITLE',    type: 'text',     required: true, defaultValue: t.title },
      { name: 'subject',  label: 'SUBJECT',  type: 'select',   options: SUBJECTS.map(s => ({ value: s, label: s })), required: true, defaultValue: t.subject },
      { name: 'type',     label: 'TYPE',     type: 'select',   options: TASK_TYPES.map(t => ({ value: t, label: t })), required: false, defaultValue: t.type || '' },
      { name: 'deadline', label: 'DEADLINE', type: 'date',     required: false, defaultValue: t.deadline || '' },
      { name: 'priority', label: 'PRIORITY', type: 'select',   options: PRIORITY.map(p => ({ value: p, label: p })), required: true, defaultValue: t.priority },
      { name: 'status',   label: 'STATUS',   type: 'select',   options: STATUS.map(s => ({ value: s, label: fmtStatus(s) })), required: true, defaultValue: t.status },
      { name: 'notes',    label: 'NOTES',    type: 'textarea', required: false, defaultValue: t.notes || '' },
      { name: 'body',     label: 'BODY',     type: 'textarea', required: false, defaultValue: t.body || '' },
    ],
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
  if (dashView && dashView.style.display !== 'none') {
    renderDashboard();
  }
}

// ============================================================
// EE TRACKER
// ============================================================
function renderEETracker() {
  const container = document.querySelector('main [data-view="ee-tracker"]');
  if (!container) return;

  const wordCount = ee.wordCount || 0;
  const pct = Math.min(100, Math.round((wordCount / 4000) * 100));
  const doneMilestones = ee.milestones.filter(m => m.done).length;

  container.innerHTML = `
    <div class="view-toolbar">
      <div class="view-context mono-label">EXTENDED ESSAY — 4,000 WORD TARGET</div>
      <button id="btn-sync-notion-ee" class="action-btn ghost">⟳ SYNC NOTION</button>
      <span id="sync-status-ee" class="mono-label sync-label"></span>
    </div>

    <div class="ee-layout">
      <div class="ee-left">
        <!-- Draft progress -->
        <div class="data-section">
          <div class="panel-header">
            <span class="panel-label mono-label">DRAFT PROGRESS</span>
            <span class="tag">${wordCount} / 4000</span>
          </div>
          <div class="ee-percent display-text">${pct}<span>%</span></div>
          <div class="progress-track">
            <div id="ee-progress-bar" class="progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="ee-wc-row">
            <input type="number" id="ee-wordcount" class="ee-wc-input" value="${wordCount}" min="0" max="4000">
            <span class="mono-label">/ 4000 WORDS</span>
          </div>
        </div>

        <!-- Meeting log -->
        <div class="data-section">
          <div class="panel-header">
            <span class="panel-label mono-label">SUPERVISOR MEETING LOG</span>
            <button id="btn-add-meeting" class="action-btn sm">+ ADD</button>
          </div>
          <div class="ee-meeting-list">
            ${ee.meetings.length ? ee.meetings.map(m => `
              <div class="ee-meeting">
                <span class="due-chip">${fmtDate(m.date)}</span>
                <span class="ee-meeting-notes">${esc(m.notes)}</span>
              </div>`).join('')
            : '<div class="empty-state">No meetings logged yet.</div>'}
          </div>
        </div>
      </div>

      <!-- Milestones -->
      <div class="data-section">
        <div class="section-header display-text">
          MILESTONES
          <span class="tag">${doneMilestones}/${ee.milestones.length} DONE</span>
        </div>
        <div class="ee-timeline">
          ${ee.milestones.length ? ee.milestones.map((m, i) => `
            <label class="ee-milestone ${m.done ? 'is-done' : ''}">
              <input type="checkbox" class="ee-milestone-check" data-id="${m.id}" ${m.done ? 'checked' : ''}>
              <span class="ee-milestone-num display-text">${String(i + 1).padStart(2, '0')}</span>
              <span class="ee-milestone-label">${esc(m.label)}</span>
            </label>`).join('')
          : '<div class="empty-state">No milestones yet — sync with Notion.</div>'}
        </div>
      </div>
    </div>`;

  // Word count input handler
  document.getElementById('ee-wordcount').addEventListener('change', e => {
    const val = parseInt(e.target.value, 10) || 0;
    updateEE({ wordCount: val });
    renderEETracker();
  });

  // Milestone checkboxes
  container.querySelectorAll('.ee-milestone-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const updated = ee.milestones.map(m =>
        m.id === cb.dataset.id ? { ...m, done: cb.checked } : m
      );
      updateEE({ milestones: updated });
      schedulePush('ee', cb.dataset.id);
      renderEETracker();
    });
  });

  document.getElementById('btn-sync-notion-ee').addEventListener('click', syncEEWithNotion);

  // Add meeting
  document.getElementById('btn-add-meeting').addEventListener('click', () => {
    openModal({
      title: 'ADD MEETING',
      fields: [
        { name: 'date',  label: 'DATE',  type: 'date',     required: true },
        { name: 'notes', label: 'NOTES', type: 'textarea', required: false },
      ],
      onSubmit(data) {
        addMeeting(data);
        renderEETracker();
      },
    });
  });
}


// ============================================================
// GREEK PORTFOLIO
// ============================================================
function renderGreekPortfolio() {
  const container = document.querySelector('main [data-view="greek-portfolio"]');
  if (!container) return;

  const slots = Math.max(4, greek.texts.length);
  const finalCount = greek.texts.filter(t => t.status === 'FINAL').length;
  const segments = greek.texts.map(t =>
    `<div class="greek-seg seg-${t.status}" title="${esc(t.title)} — ${esc(t.status)}"></div>`
  ).join('') + '<div class="greek-seg"></div>'.repeat(slots - greek.texts.length);

  container.innerHTML = `
    <div class="view-toolbar">
      <div class="view-context mono-label">LANGUAGE B HL — ORAL PORTFOLIO</div>
      <button id="btn-sync-notion-greek" class="action-btn ghost">⟳ SYNC NOTION</button>
      <span id="sync-status-greek" class="mono-label sync-label"></span>
    </div>

    <div class="greek-top">
      <!-- Global Issue -->
      <div class="data-section">
        <span class="panel-label mono-label">GLOBAL ISSUE</span>
        <textarea id="greek-global" class="issue-input" rows="3"
          placeholder="Define the global issue connecting your portfolio texts…">${esc(greek.globalIssue)}</textarea>
      </div>

      <!-- Progress -->
      <div class="data-section">
        <span class="panel-label mono-label">PORTFOLIO PROGRESS</span>
        <div class="greek-progress-num display-text">${finalCount}<span>/${slots}</span></div>
        <div class="greek-segments">${segments}</div>
        <span class="mono-label panel-foot">TEXTS FINALISED</span>
      </div>
    </div>

    <!-- Texts -->
    <div class="greek-grid">
      ${greek.texts.length ? greek.texts.map((t, i) => `
        <div class="greek-card seg-border-${t.status}">
          <div class="greek-card-head">
            <span class="greek-card-index display-text">${String(i + 1).padStart(2, '0')}</span>
            <span class="status-badge s-greek-${t.status}">${esc(t.status)}</span>
          </div>
          <div class="greek-card-title">${esc(t.title)}</div>
          <div class="greek-stepper">
            ${GREEK_TEXT_STATUSES.map(s => `
              <button class="greek-status-step ${t.status === s ? 'step-active' : ''}"
                data-id="${t.id}" data-status="${s}">${s}</button>`).join('')}
          </div>
          <div class="greek-card-fields">
            <label class="mono-label">WORDS
              <input type="number" class="greek-wc-input" data-id="${t.id}" value="${t.wordCount || 0}" min="0">
            </label>
            <label class="mono-label">NOTES
              <textarea class="greek-notes-input" data-id="${t.id}" rows="2" placeholder="—">${esc(t.notes || '')}</textarea>
            </label>
          </div>
        </div>`).join('')
      : '<div class="empty-state">No texts yet — sync with Notion to pull your portfolio.</div>'}
    </div>`;

  // Global issue auto-save
  document.getElementById('greek-global').addEventListener('blur', e => {
    updateGreek({ globalIssue: e.target.value });
  });

  // Status stepper — click a state to set it directly
  container.querySelectorAll('.greek-status-step').forEach(btn => {
    btn.addEventListener('click', () => {
      updateGreekText(btn.dataset.id, { status: btn.dataset.status });
      schedulePush('greek', btn.dataset.id);
      renderGreekPortfolio();
    });
  });

  // Word count inputs
  container.querySelectorAll('.greek-wc-input').forEach(input => {
    input.addEventListener('change', e => {
      updateGreekText(e.target.dataset.id, { wordCount: parseInt(e.target.value, 10) || 0 });
      renderGreekPortfolio();
    });
  });

  document.getElementById('btn-sync-notion-greek').addEventListener('click', syncGreekWithNotion);

  // Notes textareas
  container.querySelectorAll('.greek-notes-input').forEach(ta => {
    ta.addEventListener('blur', e => {
      updateGreekText(e.target.dataset.id, { notes: e.target.value });
    });
  });
}

// ============================================================
// NOTION SYNC
// ============================================================
const syncState = {
  assignments: { pending: new Set(), timer: null },
  projects:    { pending: new Set(), timer: null },
  ee:          { pending: new Set(), timer: null },
  greek:       { pending: new Set(), timer: null },
};

const SYNC_BTN_IDS = { assignments: 'btn-sync-notion', projects: 'btn-sync-notion-projects', ee: 'btn-sync-notion-ee', greek: 'btn-sync-notion-greek' };
const SYNC_LBL_IDS = { assignments: 'sync-status',     projects: 'sync-status-projects',     ee: 'sync-status-ee',   greek: 'sync-status-greek' };
function getSyncBtn(v) { return document.getElementById(SYNC_BTN_IDS[v]); }
function getSyncLbl(v) { return document.getElementById(SYNC_LBL_IDS[v]); }

function schedulePush(viewKey, itemId) {
  syncState[viewKey].pending.add(itemId);
  clearTimeout(syncState[viewKey].timer);
  syncState[viewKey].timer = setTimeout(() => flushPushForView(viewKey), 2000);
}

async function flushPushForView(viewKey) {
  const btn = getSyncBtn(viewKey), lbl = getSyncLbl(viewKey);
  if (viewKey === 'assignments') await flushPushAssignments(btn, lbl);
  else if (viewKey === 'projects') await flushPushProjects(btn, lbl);
  else if (viewKey === 'ee')       await flushPushEE(btn, lbl);
  else if (viewKey === 'greek')    await flushPushGreek(btn, lbl);
}

function setSyncStatus(state, btnEl, lblEl, msg = '') {
  if (!btnEl || !lblEl) return;
  const states = {
    idle:    { text: '⟳ SYNC NOTION', color: '#555', label: '' },
    syncing: { text: '⟳ SYNCING…',    color: 'var(--accent)', label: 'WORKING…' },
    success: { text: '⟳ SYNC NOTION', color: 'var(--status-done)', label: '✓ SYNCED' },
    error:   { text: '⟳ SYNC NOTION', color: 'var(--status-blocked)', label: '✗ ' + msg },
  };
  const s = states[state] || states.idle;
  btnEl.textContent       = s.text;
  btnEl.style.color       = s.color;
  btnEl.style.borderColor = s.color;
  lblEl.textContent       = s.label;
  lblEl.style.color       = s.color;
}

async function flushPushAssignments(btnEl, lblEl) {
  const state = syncState.assignments;
  if (!state.pending.size) return;
  const ids = [...state.pending];
  state.pending.clear();
  setSyncStatus('syncing', btnEl, lblEl);
  try {
    for (const id of ids) {
      const t = tasks.find(t => t.id === id);
      if (!t) continue;
      if (t.notionId) {
        await updateNotionTask(t.notionId, t);
        if (t.body?.trim()) await updatePageBody(t.notionId, t.body).catch(err => console.error('Body push failed:', err));
      } else {
        const page = await createNotionTask(t);
        if (page?.id) {
          updateTask(t.id, { notionId: page.id });
          if (t.body?.trim()) await updatePageBody(page.id, t.body).catch(err => console.error('Body push failed:', err));
        }
      }
    }
    setSyncStatus('success', btnEl, lblEl);
    setTimeout(() => setSyncStatus('idle', btnEl, lblEl), 2000);
  } catch (err) {
    console.error('Auto-sync failed:', err);
    setSyncStatus('error', btnEl, lblEl, err.message);
  }
}

async function syncAssignmentsWithNotion() {
  const btnEl = getSyncBtn('assignments'), lblEl = getSyncLbl('assignments');
  setSyncStatus('syncing', btnEl, lblEl);

  try {
    // 1. Fetch all pages from Notion
    const notionPages = await fetchAllNotionTasks();

    // 2. Build lookup maps
    const localByNotionId = Object.fromEntries(
      tasks.filter(t => t.notionId).map(t => [t.notionId, t])
    );
    const notionIdSet = new Set(notionPages.map(p => p.id));

    let updated = [...tasks];

    // 3. Process each Notion page
    for (const page of notionPages) {
      const remote = fromNotionPage(page);
      const local  = localByNotionId[page.id];

      if (local) {
        // Exists locally — last-write-wins on updatedAt
        const remoteTime = new Date(page.last_edited_time);
        const localTime  = new Date(local.updatedAt);
        if (remoteTime >= localTime) {
          // Notion is newer (or equal): pull body (skip for DONE), update local
          const body = remote.status !== 'DONE' ? await fetchPageBody(page.id) : (local.body || '');
          updated = updated.map(t =>
            t.id === local.id ? { ...t, ...remote, body, id: t.id, createdAt: t.createdAt } : t
          );
        } else {
          // Local is newer: push properties and body to Notion
          await updateNotionTask(page.id, local);
          if (local.status !== 'DONE') await updatePageBody(page.id, local.body || '');
        }
      } else {
        // New in Notion: pull properties and body (skip body for DONE)
        const body = remote.status !== 'DONE' ? await fetchPageBody(page.id) : '';
        updated = [...updated, {
          id:        generateId('task'),
          createdAt: page.created_time,
          updatedAt: page.last_edited_time,
          body,
          ...remote,
        }];
      }
    }

    // 4. Push local tasks that have no notionId yet
    const needsPush = updated.filter(t => !t.notionId);
    for (const task of needsPush) {
      const page = await createNotionTask(task);
      updated = updated.map(t =>
        t.id === task.id ? { ...t, notionId: page.id } : t
      );
      if (task.body?.trim()) {
        await updatePageBody(page.id, task.body).catch(err => console.error('Body push failed:', err));
      }
    }

    // 5. Drop DONE tasks older than 7 days, then commit and re-render
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    updated = updated.filter(t =>
      t.status !== 'DONE' || new Date(t.updatedAt).getTime() >= cutoff
    );
    setTasks(updated);
    setSyncStatus('success', btnEl, lblEl);
    setTimeout(() => setSyncStatus('idle', btnEl, lblEl), 3000);
    renderAndRefreshDash();
  } catch (err) {
    console.error('Notion sync failed:', err);
    setSyncStatus('error', btnEl, lblEl, err.message);
  }
}

// ── Projects flush + sync ─────────────────────────────────────────────────

async function flushPushProjects(btnEl, lblEl) {
  const state = syncState.projects;
  if (!state.pending.size) return;
  const ids = [...state.pending];
  state.pending.clear();
  setSyncStatus('syncing', btnEl, lblEl);
  try {
    for (const id of ids) {
      const p = projects.find(p => p.id === id);
      if (!p) continue;
      if (p.notionId) {
        await updateNotionProject(p.notionId, p);
      } else {
        const page = await createNotionProject(p);
        if (page?.id) updateProject(p.id, { notionId: page.id });
      }
    }
    setSyncStatus('success', btnEl, lblEl);
    setTimeout(() => setSyncStatus('idle', btnEl, lblEl), 2000);
  } catch (err) {
    console.error('Projects auto-sync failed:', err);
    setSyncStatus('error', btnEl, lblEl, err.message);
  }
}

async function syncProjectsWithNotion() {
  const btnEl = getSyncBtn('projects'), lblEl = getSyncLbl('projects');
  setSyncStatus('syncing', btnEl, lblEl);
  try {
    const notionPages = await fetchAllNotionProjects();
    const localByNotionId = Object.fromEntries(
      projects.filter(p => p.notionId).map(p => [p.notionId, p])
    );
    let updated = [...projects];

    for (const page of notionPages) {
      const remote = fromNotionProject(page);
      const local  = localByNotionId[page.id];
      if (local) {
        const remoteTime = new Date(remote.notionUpdatedAt);
        const localTime  = new Date(local.notionUpdatedAt || 0);
        if (remoteTime >= localTime) {
          updated = updated.map(p =>
            p.id === local.id ? { ...p, ...remote, id: p.id, priority: p.priority } : p
          );
        } else {
          await updateNotionProject(page.id, local);
        }
      } else {
        updated = [...updated, {
          id:       generateId('proj'),
          priority: 'NORMAL',
          ...remote,
        }];
      }
    }

    const needsPush = updated.filter(p => !p.notionId);
    for (const proj of needsPush) {
      const page = await createNotionProject(proj);
      updated = updated.map(p => p.id === proj.id ? { ...p, notionId: page.id } : p);
    }

    updated.forEach(p => updateProject(p.id, p));
    // Add truly new projects that don't exist yet
    const existingIds = new Set(projects.map(p => p.id));
    updated.filter(p => !existingIds.has(p.id)).forEach(p => createProject(p));

    setSyncStatus('success', btnEl, lblEl);
    setTimeout(() => setSyncStatus('idle', btnEl, lblEl), 3000);
    renderPM();
  } catch (err) {
    console.error('Projects sync failed:', err);
    setSyncStatus('error', btnEl, lblEl, err.message);
  }
}

// ── EE flush + sync ────────────────────────────────────────────────────────

async function flushPushEE(btnEl, lblEl) {
  const state = syncState.ee;
  if (!state.pending.size) return;
  const ids = [...state.pending];
  state.pending.clear();
  setSyncStatus('syncing', btnEl, lblEl);
  try {
    for (const id of ids) {
      const m = ee.milestones.find(m => m.id === id);
      if (!m) continue;
      if (m.notionId) {
        await updateNotionMilestone(m.notionId, m);
      } else {
        const page = await createNotionMilestone(m);
        if (page?.id) {
          const updatedMilestones = ee.milestones.map(ms =>
            ms.id === id ? { ...ms, notionId: page.id } : ms
          );
          updateEE({ milestones: updatedMilestones });
        }
      }
    }
    setSyncStatus('success', btnEl, lblEl);
    setTimeout(() => setSyncStatus('idle', btnEl, lblEl), 2000);
  } catch (err) {
    console.error('EE auto-sync failed:', err);
    setSyncStatus('error', btnEl, lblEl, err.message);
  }
}

async function syncEEWithNotion() {
  const btnEl = getSyncBtn('ee'), lblEl = getSyncLbl('ee');
  setSyncStatus('syncing', btnEl, lblEl);
  try {
    const notionPages = await fetchAllNotionMilestones();
    const localByNotionId = Object.fromEntries(
      ee.milestones.filter(m => m.notionId).map(m => [m.notionId, m])
    );
    let updatedMilestones = [...ee.milestones];

    for (const page of notionPages) {
      const remote = fromNotionMilestone(page);
      const local  = localByNotionId[page.id];
      if (local) {
        const remoteTime = new Date(remote.notionUpdatedAt);
        const localTime  = new Date(local.notionUpdatedAt || 0);
        if (remoteTime >= localTime) {
          updatedMilestones = updatedMilestones.map(m =>
            m.id === local.id ? { ...m, label: remote.label, done: remote.done, notionId: remote.notionId, notionUpdatedAt: remote.notionUpdatedAt } : m
          );
        } else {
          await updateNotionMilestone(page.id, local);
        }
      } else {
        updatedMilestones = [...updatedMilestones, {
          id:    generateId('ee'),
          ...remote,
        }];
      }
    }

    const needsPush = updatedMilestones.filter(m => !m.notionId);
    for (const milestone of needsPush) {
      const page = await createNotionMilestone(milestone);
      updatedMilestones = updatedMilestones.map(m =>
        m.id === milestone.id ? { ...m, notionId: page.id } : m
      );
    }

    updateEE({ milestones: updatedMilestones });
    setSyncStatus('success', btnEl, lblEl);
    setTimeout(() => setSyncStatus('idle', btnEl, lblEl), 3000);
    renderEETracker();
  } catch (err) {
    console.error('EE sync failed:', err);
    setSyncStatus('error', btnEl, lblEl, err.message);
  }
}

// ── Greek flush + sync ─────────────────────────────────────────────────────

async function flushPushGreek(btnEl, lblEl) {
  const state = syncState.greek;
  if (!state.pending.size) return;
  const ids = [...state.pending];
  state.pending.clear();
  setSyncStatus('syncing', btnEl, lblEl);
  try {
    for (const id of ids) {
      const t = greek.texts.find(t => t.id === id);
      if (!t) continue;
      if (t.notionId) {
        await updateNotionText(t.notionId, t);
      } else {
        const page = await createNotionText(t);
        if (page?.id) {
          const updatedTexts = greek.texts.map(tx =>
            tx.id === id ? { ...tx, notionId: page.id } : tx
          );
          updateGreek({ texts: updatedTexts });
        }
      }
    }
    setSyncStatus('success', btnEl, lblEl);
    setTimeout(() => setSyncStatus('idle', btnEl, lblEl), 2000);
  } catch (err) {
    console.error('Greek auto-sync failed:', err);
    setSyncStatus('error', btnEl, lblEl, err.message);
  }
}

async function syncGreekWithNotion() {
  const btnEl = getSyncBtn('greek'), lblEl = getSyncLbl('greek');
  setSyncStatus('syncing', btnEl, lblEl);
  try {
    const notionPages = await fetchAllNotionTexts();
    const localByNotionId = Object.fromEntries(
      greek.texts.filter(t => t.notionId).map(t => [t.notionId, t])
    );
    let updatedTexts = [...greek.texts];

    for (const page of notionPages) {
      const remote = fromNotionText(page);
      const local  = localByNotionId[page.id];
      if (local) {
        const remoteTime = new Date(remote.notionUpdatedAt);
        const localTime  = new Date(local.notionUpdatedAt || 0);
        if (remoteTime >= localTime) {
          updatedTexts = updatedTexts.map(t =>
            t.id === local.id ? { ...t, title: remote.title, status: remote.status, notionId: remote.notionId, notionUpdatedAt: remote.notionUpdatedAt } : t
          );
        } else {
          await updateNotionText(page.id, local);
        }
      } else {
        updatedTexts = [...updatedTexts, {
          id:        generateId('grk'),
          wordCount: 0,
          notes:     '',
          ...remote,
        }];
      }
    }

    const needsPush = updatedTexts.filter(t => !t.notionId);
    for (const text of needsPush) {
      const page = await createNotionText(text);
      updatedTexts = updatedTexts.map(t =>
        t.id === text.id ? { ...t, notionId: page.id } : t
      );
    }

    updateGreek({ texts: updatedTexts });
    setSyncStatus('success', btnEl, lblEl);
    setTimeout(() => setSyncStatus('idle', btnEl, lblEl), 3000);
    renderGreekPortfolio();
  } catch (err) {
    console.error('Greek sync failed:', err);
    setSyncStatus('error', btnEl, lblEl, err.message);
  }
}

// ============================================================
// DEV PM VIEW
// ============================================================
const PM_STATUS_CYCLE = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'];
const PM_BOARD_COLS   = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'];
const PROJ_STATUS_ORDER = { ACTIVE: 0, PAUSED: 1, DONE: 2 };
let pmSubView    = 'projects';
let pmTicketMode = 'table';
let pmFilterAssignee = '', pmFilterPriority = '', pmFilterStatus = '';
let projFilterStatus = '', projSortField = 'status', projSortDir = 'asc';

function renderPM() {
  const container = document.querySelector('main [data-view="projects"]');
  if (!container) return;

  const activeId = getPMActiveProject();
  const proj = projects.find(p => p.id === activeId);

  container.innerHTML = `
    <div class="view-toolbar" style="margin-bottom:0">
      <div class="view-toggle">
        <button class="toggle-btn pm-tab ${pmSubView === 'projects' ? 'view-active' : ''}" data-tab="projects">PROJECTS</button>
        <button class="toggle-btn pm-tab ${pmSubView === 'tickets' ? 'view-active' : ''}" data-tab="tickets">TICKETS</button>
        <button class="toggle-btn pm-tab ${pmSubView === 'team' ? 'view-active' : ''}" data-tab="team">TEAM</button>
      </div>
      <div style="display:flex;align-items:center;gap:var(--spacing-sm);margin-left:auto">
        ${proj ? `<span class="mono-label sync-label">ACTIVE: <span style="color:var(--accent)">${esc(proj.name)}</span></span>` : ''}
        <button id="btn-pm-new" class="action-btn">+ NEW ${pmSubView === 'projects' ? 'PROJECT' : pmSubView === 'tickets' ? 'TICKET' : 'MEMBER'}</button>
      </div>
    </div>
    <div id="pm-content" style="margin-top:var(--spacing-md)"></div>`;

  container.querySelectorAll('.pm-tab').forEach(btn => {
    btn.addEventListener('click', () => { pmSubView = btn.dataset.tab; renderPM(); });
  });

  document.getElementById('btn-pm-new').addEventListener('click', () => {
    if (pmSubView === 'projects') openNewPMProjectModal();
    else if (pmSubView === 'tickets') openNewPMTicketModal();
    else openNewPMMemberModal();
  });

  const content = document.getElementById('pm-content');
  if (pmSubView === 'projects') renderPMProjects(content);
  else if (pmSubView === 'tickets') renderPMTickets(content);
  else renderPMTeam(content);
}

// PM PROJECTS
function filteredSortedProjects(allTickets) {
  let list = [...projects];
  if (projFilterStatus) list = list.filter(p => p.status === projFilterStatus);
  list.sort((a, b) => {
    let va, vb;
    if (projSortField === 'status') {
      va = PROJ_STATUS_ORDER[a.status] ?? 99;
      vb = PROJ_STATUS_ORDER[b.status] ?? 99;
    } else if (projSortField === 'open') {
      va = allTickets.filter(t => t.projectId === a.id && t.status !== 'DONE').length;
      vb = allTickets.filter(t => t.projectId === b.id && t.status !== 'DONE').length;
    } else {
      va = (a[projSortField] || '').toLowerCase();
      vb = (b[projSortField] || '').toLowerCase();
    }
    if (va < vb) return projSortDir === 'asc' ? -1 : 1;
    if (va > vb) return projSortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return list;
}

function renderPMProjects(container) {
  const allTickets  = getPMTickets();
  const activeId    = getPMActiveProject();
  const statusColor = { ACTIVE: 'var(--accent)', PAUSED: '#555', DONE: 'var(--status-done)' };
  const projList    = filteredSortedProjects(allTickets);

  container.innerHTML = `
    <div class="view-toolbar" style="margin-bottom:var(--spacing-md)">
      <div class="filter-bar">
        <select id="proj-filter-status" class="filter-select">
          <option value="">ALL STATUS</option>
          ${SIDE_QUEST_STATUSES.map(s => `<option value="${s}" ${projFilterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select id="proj-sort-field" class="filter-select">
          <option value="status">SORT: STATUS</option>
          <option value="name">SORT: NAME</option>
          <option value="open">SORT: OPEN TICKETS</option>
        </select>
        <select id="proj-sort-dir" class="filter-select">
          <option value="asc">ASC ↑</option>
          <option value="desc">DESC ↓</option>
        </select>
      </div>
      <button id="btn-sync-notion-projects" class="action-btn ghost">⟳ SYNC NOTION</button>
      <span id="sync-status-projects" class="mono-label sync-label"></span>
    </div>
    <div class="project-grid">
      ${projList.map(p => {
        const tickets  = allTickets.filter(t => t.projectId === p.id);
        const open     = tickets.filter(t => t.status !== 'DONE').length;
        const isActive = p.id === activeId;
        const updated  = tickets.reduce((l, t) => t.updatedAt > l ? t.updatedAt : l, p.createdAt || new Date().toISOString());
        const tags     = [...(p._notionCategory || []), ...(p._notionBusiness || [])];
        return `<div class="project-card ${isActive ? 'project-active' : ''}" data-id="${p.id}">
          <div class="project-phase-bar">
            <span class="mono-label" style="color:${statusColor[p.status] || '#555'}">● ${p.status || 'PAUSED'}</span>
            ${p._notionLink ? `<a href="${esc(p._notionLink)}" target="_blank" rel="noopener" class="edit-btn" style="text-decoration:none;margin-left:auto" title="Open in Notion">↗</a>` : ''}
          </div>
          <div class="project-name display-text">${esc(p.name)}</div>
          ${tags.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">${tags.map(t => `<span class="due-chip">${esc(t)}</span>`).join('')}</div>` : ''}
          ${p.lastAction ? `<div class="project-desc"><span class="mono-label" style="color:#555">LAST: </span>${esc(p.lastAction)}</div>` : ''}
          ${p.nextStep   ? `<div class="project-desc"><span class="mono-label" style="color:#555">NEXT: </span>${esc(p.nextStep)}</div>` : ''}
          <div class="project-meta">
            <div class="project-stats">
              <span class="mono-label">${open} OPEN</span>
              <span class="mono-label" style="color:#444">/ ${tickets.length} TOTAL</span>
            </div>
            <span class="mono-label" style="color:#444">${timeAgo(updated)}</span>
          </div>
          <div class="project-card-actions">
            <button class="set-active-btn mono-label pm-set-active" data-id="${p.id}">
              ${isActive ? '&#x2713; ACTIVE' : 'SET ACTIVE &#x2192;'}
            </button>
            <div class="project-action-btns">
              <button class="edit-btn pm-edit-proj" data-id="${p.id}">&#x270E; EDIT</button>
              <button class="edit-btn pm-del-proj" data-id="${p.id}" data-count="${tickets.length}">&#x2715; DELETE</button>
            </div>
          </div>
        </div>`;
      }).join('') || '<div class="empty-state" style="grid-column:1/-1">No projects match the current filters.</div>'}
    </div>`;

  // Sync filter/sort dropdowns to current state
  const projFilterStatusEl = document.getElementById('proj-filter-status');
  const projSortFieldEl    = document.getElementById('proj-sort-field');
  const projSortDirEl      = document.getElementById('proj-sort-dir');
  if (projFilterStatusEl) projFilterStatusEl.value = projFilterStatus;
  if (projSortFieldEl)    projSortFieldEl.value    = projSortField;
  if (projSortDirEl)      projSortDirEl.value      = projSortDir;

  projFilterStatusEl.addEventListener('change', e => { projFilterStatus = e.target.value; renderPM(); });
  projSortFieldEl.addEventListener('change',    e => { projSortField    = e.target.value; renderPM(); });
  projSortDirEl.addEventListener('change',      e => { projSortDir      = e.target.value; renderPM(); });

  document.getElementById('btn-sync-notion-projects').addEventListener('click', syncProjectsWithNotion);

  container.querySelectorAll('.pm-set-active').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); setPMActiveProject(btn.dataset.id); renderPM(); });
  });
  container.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => { setPMActiveProject(card.dataset.id); pmSubView = 'tickets'; renderPM(); });
  });
  container.querySelectorAll('.pm-edit-proj').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const p = projects.find(p => p.id === btn.dataset.id);
      if (!p) return;
      openModal({
        title: 'EDIT PROJECT', submitLabel: 'SAVE',
        fields: [
          { name: 'name',       label: 'PROJECT NAME', defaultValue: p.name },
          { name: 'status',     label: 'STATUS', type: 'select', defaultValue: p.status, options: SIDE_QUEST_STATUSES },
          { name: 'lastAction', label: 'LAST ACTION', required: false, defaultValue: p.lastAction || '' },
          { name: 'nextStep',   label: 'NEXT STEP', required: false, defaultValue: p.nextStep || '' },
        ],
        onSubmit(data) {
          updateProject(btn.dataset.id, data);
          schedulePush('projects', btn.dataset.id);
          renderPM();
        },
      });
    });
  });
  container.querySelectorAll('.pm-del-proj').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (btn.dataset.confirm) {
        const id = btn.dataset.id;
        const p = projects.find(p => p.id === id);
        if (p?.notionId) archiveNotionProject(p.notionId).catch(err => console.error('Notion archive failed:', err));
        deleteProject(id);
        if (getPMActiveProject() === id) {
          const remaining = projects.filter(p => p.id !== id);
          setPMActiveProject(remaining[0]?.id ?? null);
        }
        renderPM();
      } else {
        btn.dataset.confirm = '1';
        const n = btn.dataset.count;
        btn.textContent = `DELETE (${n} ticket${n == 1 ? '' : 's'})?`;
        btn.style.color = 'var(--status-blocked)';
        setTimeout(() => { if (btn.dataset.confirm) { btn.dataset.confirm = ''; btn.innerHTML = '&#x2715; DELETE'; btn.style.color = ''; } }, 3000);
      }
    });
  });
}

function openNewPMProjectModal() {
  openModal({
    title: 'NEW PROJECT',
    fields: [
      { name: 'name',       label: 'PROJECT NAME' },
      { name: 'status',     label: 'STATUS', type: 'select', options: SIDE_QUEST_STATUSES },
      { name: 'lastAction', label: 'LAST ACTION', required: false },
      { name: 'nextStep',   label: 'NEXT STEP', required: false },
    ],
    onSubmit(data) {
      const result = createProject(data);
      schedulePush('projects', result.id);
      renderPM();
    },
  });
}

// PM TICKETS
function renderPMTickets(container) {
  const activeId = getPMActiveProject();
  let tickets = getPMTickets().filter(t => t.projectId === activeId);
  if (pmFilterAssignee) tickets = tickets.filter(t => t.assignee === pmFilterAssignee);
  if (pmFilterPriority) tickets = tickets.filter(t => t.priority === pmFilterPriority);
  if (pmFilterStatus)   tickets = tickets.filter(t => t.status === pmFilterStatus);

  const team = getPMTeam();

  container.innerHTML = `
    <div class="view-toolbar" style="margin-bottom:var(--spacing-md)">
      <div class="view-toggle">
        <button id="pm-btn-table" class="toggle-btn ${pmTicketMode === 'table' ? 'view-active' : ''}">TABLE</button>
        <button id="pm-btn-board" class="toggle-btn ${pmTicketMode === 'board' ? 'view-active' : ''}">BOARD</button>
      </div>
      <div class="filter-bar">
        <select id="pm-filter-assignee" class="filter-select">
          <option value="">ALL ASSIGNEES</option>
          ${team.map(m => `<option value="${esc(m.name)}" ${pmFilterAssignee === m.name ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
        </select>
        <select id="pm-filter-priority" class="filter-select">
          <option value="">ALL PRIORITIES</option>
          ${['CRITICAL','HIGH','NORMAL','LOW'].map(p => `<option value="${p}" ${pmFilterPriority === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
        <select id="pm-filter-status" class="filter-select">
          <option value="">ALL STATUSES</option>
          ${['TODO','IN_PROGRESS','REVIEW','DONE','BLOCKED'].map(s => `<option value="${s}" ${pmFilterStatus === s ? 'selected' : ''}>${fmtStatus(s)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="pm-ticket-table" class="task-list" ${pmTicketMode === 'board' ? 'style="display:none"' : ''}></div>
    <div id="pm-ticket-board" class="board-container board-5col" ${pmTicketMode === 'table' ? 'style="display:none"' : ''}></div>`;

  document.getElementById('pm-btn-table').addEventListener('click', () => { pmTicketMode = 'table'; renderPM(); });
  document.getElementById('pm-btn-board').addEventListener('click', () => { pmTicketMode = 'board'; renderPM(); });
  document.getElementById('pm-filter-assignee').addEventListener('change', e => { pmFilterAssignee = e.target.value; renderPM(); });
  document.getElementById('pm-filter-priority').addEventListener('change', e => { pmFilterPriority = e.target.value; renderPM(); });
  document.getElementById('pm-filter-status').addEventListener('change', e => { pmFilterStatus = e.target.value; renderPM(); });

  if (pmTicketMode === 'table') {
    renderPMTicketTable(tickets, document.getElementById('pm-ticket-table'));
  } else {
    renderPMTicketBoard(tickets, document.getElementById('pm-ticket-board'));
  }
}

function renderPMTicketTable(tickets, el) {
  const cols = '1fr 120px 80px 100px 72px';
  el.innerHTML = `
    <div class="task-row table-header" style="grid-template-columns:${cols}">
      <div class="mono-label">TITLE</div>
      <div class="mono-label">ASSIGNEE</div>
      <div class="mono-label">PRIORITY</div>
      <div class="mono-label" style="text-align:right">STATUS</div>
      <div></div>
    </div>
    ${tickets.length ? tickets.map(t => `
      <div class="task-row ticket-row" style="grid-template-columns:${cols}">
        <div class="task-title">
          ${esc(t.title)}
          ${t.dueDate ? `<span class="due-chip">DUE ${fmtDate(t.dueDate)}</span>` : ''}
        </div>
        <div class="task-assignee">${esc(t.assignee || '—')}</div>
        <div class="priority-badge p-${t.priority}">${t.priority}</div>
        <div class="status-badge s-${t.status} clickable-pm-status" data-id="${t.id}" title="Click to cycle status">${fmtStatus(t.status)}</div>
        <div class="ticket-actions">
          <button class="edit-btn pm-edit-ticket" data-id="${t.id}" title="Edit">&#x270E;</button>
          <button class="edit-btn pm-del-ticket" data-id="${t.id}" title="Delete">&#x2715;</button>
        </div>
      </div>`).join('')
    : '<div class="empty-state">No tickets match the current filters.</div>'}`;

  el.querySelectorAll('.clickable-pm-status').forEach(badge => {
    badge.addEventListener('click', e => {
      e.stopPropagation();
      const t = getPMTickets().find(t => t.id === badge.dataset.id);
      if (!t) return;
      const next = PM_STATUS_CYCLE[(PM_STATUS_CYCLE.indexOf(t.status) + 1) % PM_STATUS_CYCLE.length];
      updatePMTicket(badge.dataset.id, { status: next });
      renderPM();
    });
  });
  el.querySelectorAll('.pm-edit-ticket').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditPMTicketModal(btn.dataset.id); });
  });
  el.querySelectorAll('.pm-del-ticket').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (btn.dataset.confirm) {
        deletePMTicket(btn.dataset.id);
        renderPM();
      } else {
        btn.dataset.confirm = '1';
        btn.textContent = 'SURE?';
        btn.style.color = 'var(--status-blocked)';
        setTimeout(() => { if (btn.dataset.confirm) { btn.dataset.confirm = ''; btn.innerHTML = '&#x2715;'; btn.style.color = ''; } }, 3000);
      }
    });
  });
}

function renderPMTicketBoard(tickets, el) {
  el.innerHTML = PM_BOARD_COLS.map(col => {
    const colTickets = col === 'TODO'
      ? tickets.filter(t => t.status === col || t.status === 'BLOCKED')
      : tickets.filter(t => t.status === col);
    return `<div class="board-col">
      <div class="board-col-header">
        <span class="status-badge s-${col}">${fmtStatus(col)}</span>
        <span class="mono-label board-col-count">${colTickets.length}</span>
      </div>
      <div class="board-col-cards pm-drop-zone" data-col="${col}">
        ${colTickets.map(t => `
          <div class="board-card s-border-${t.status}" draggable="true" data-id="${t.id}">
            <div class="card-title-row">
              <div class="card-title">${esc(t.title)}</div>
              <button class="edit-btn pm-card-edit" data-id="${t.id}" title="Edit">&#x270E;</button>
            </div>
            ${t.description ? `<div class="card-desc">${esc(t.description.length > 60 ? t.description.slice(0, 60) + '\u2026' : t.description)}</div>` : ''}
            <div class="card-meta">
              <span class="priority-badge p-${t.priority}">${t.priority}</span>
              <span class="card-assignee">${esc(t.assignee || '—')}</span>
            </div>
            ${t.dueDate ? `<div class="due-chip" style="margin-top:6px">DUE ${fmtDate(t.dueDate)}</div>` : ''}
            ${t.status === 'BLOCKED' ? '<div class="card-blocked-badge">BLOCKED</div>' : ''}
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.board-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', card.dataset.id); card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  el.querySelectorAll('.pm-drop-zone').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      updatePMTicket(id, { status: zone.dataset.col });
      renderPM();
    });
  });
  el.querySelectorAll('.pm-card-edit').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditPMTicketModal(btn.dataset.id); });
  });
}

function openNewPMTicketModal() {
  const team = getPMTeam();
  openModal({
    title: 'NEW TICKET',
    fields: [
      { name: 'title',       label: 'TITLE' },
      { name: 'assignee',    label: 'ASSIGNEE', type: 'select', required: false,
        options: [{ value: '', label: '— None —' }, ...team.map(m => ({ value: m.name, label: m.name }))] },
      { name: 'priority',    label: 'PRIORITY', type: 'select', options: ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'] },
      { name: 'status',      label: 'STATUS', type: 'select', options: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'] },
      { name: 'description', label: 'DESCRIPTION', type: 'textarea', required: false },
      { name: 'dueDate',     label: 'DUE DATE', type: 'date', required: false },
    ],
    onSubmit(data) { createPMTicket({ ...data, projectId: getPMActiveProject() }); renderPM(); },
  });
}

function openEditPMTicketModal(id) {
  const t = getPMTickets().find(t => t.id === id);
  if (!t) return;
  const team = getPMTeam();
  openModal({
    title: 'EDIT TICKET', submitLabel: 'SAVE',
    fields: [
      { name: 'title',       label: 'TITLE', defaultValue: t.title },
      { name: 'assignee',    label: 'ASSIGNEE', type: 'select', required: false, defaultValue: t.assignee,
        options: [{ value: '', label: '— None —' }, ...team.map(m => ({ value: m.name, label: m.name }))] },
      { name: 'priority',    label: 'PRIORITY', type: 'select', defaultValue: t.priority, options: ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'] },
      { name: 'status',      label: 'STATUS', type: 'select', defaultValue: t.status, options: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'] },
      { name: 'description', label: 'DESCRIPTION', type: 'textarea', required: false, defaultValue: t.description || '' },
      { name: 'dueDate',     label: 'DUE DATE', type: 'date', required: false, defaultValue: t.dueDate || '' },
    ],
    onSubmit(data) { updatePMTicket(id, data); renderPM(); },
  });
}

// PM TEAM
function renderPMTeam(container) {
  const team      = getPMTeam();
  const activeId  = getPMActiveProject();
  const tickets   = getPMTickets().filter(t => t.projectId === activeId);

  container.innerHTML = `
    <div class="section-header display-text" style="font-size:32px;margin-bottom:var(--spacing-md)">TEAM</div>
    <div class="team-list">
      ${team.map(m => {
        const myTickets = tickets.filter(t => t.assignee === m.name);
        const open      = myTickets.filter(t => t.status !== 'DONE').length;
        const blocked   = myTickets.filter(t => t.status === 'BLOCKED').length;
        return `<div class="team-row ${blocked > 0 ? 'has-blocked' : ''}">
          <div class="member-circle-lg ${blocked > 0 ? 'has-blocked' : ''}">${esc(m.initials)}</div>
          <div class="member-info">
            <div class="member-name">${esc(m.name)}</div>
            <div class="member-role mono-label">${esc(m.role)}</div>
          </div>
          <div class="member-stats">
            <span class="mono-label">${open} OPEN</span>
            ${blocked > 0 ? `<span class="status-badge s-BLOCKED">${blocked} BLOCKED</span>` : ''}
          </div>
          <div class="member-actions">
            <button class="edit-btn pm-edit-member" data-id="${m.id}" title="Edit">&#x270E;</button>
            <button class="delete-member-btn pm-del-member" data-id="${m.id}" title="Remove">&#x2715;</button>
          </div>
        </div>`;
      }).join('') || '<div class="empty-state">No team members yet.</div>'}
    </div>`;

  container.querySelectorAll('.pm-edit-member').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = getPMTeam().find(m => m.id === btn.dataset.id);
      if (!m) return;
      openModal({
        title: 'EDIT MEMBER', submitLabel: 'SAVE',
        fields: [
          { name: 'name',     label: 'FULL NAME', defaultValue: m.name },
          { name: 'initials', label: 'INITIALS (2 chars)', defaultValue: m.initials },
          { name: 'role',     label: 'ROLE', type: 'select', defaultValue: m.role, options: ['Frontend', 'Backend', 'Design', 'DevOps', 'PM'] },
        ],
        onSubmit(data) { updatePMMember(btn.dataset.id, data); renderPM(); },
      });
    });
  });
  container.querySelectorAll('.pm-del-member').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.confirm) {
        deletePMMember(btn.dataset.id);
        renderPM();
      } else {
        btn.dataset.confirm = '1';
        btn.textContent = 'SURE?';
        btn.style.color = 'var(--status-blocked)';
        setTimeout(() => { if (btn.dataset.confirm) { btn.dataset.confirm = ''; btn.innerHTML = '&#x2715;'; btn.style.color = ''; } }, 3000);
      }
    });
  });
}

function openNewPMMemberModal() {
  openModal({
    title: 'NEW MEMBER',
    fields: [
      { name: 'name',     label: 'FULL NAME' },
      { name: 'initials', label: 'INITIALS (2 chars)' },
      { name: 'role',     label: 'ROLE', type: 'select', options: ['Frontend', 'Backend', 'Design', 'DevOps', 'PM'] },
    ],
    onSubmit(data) { createPMMember(data); renderPM(); },
  });
}

// ============================================================
// BOOT
// ============================================================
initModal();
initAssignments();

if (projects.length === 0)      syncProjectsWithNotion();
if (ee.milestones.length === 0) syncEEWithNotion();
if (greek.texts.length === 0)   syncGreekWithNotion();

registerView('dashboard',       renderDashboard);
registerView('assignments',     renderAssignments);
registerView('ee-tracker',      renderEETracker);
registerView('greek-portfolio', renderGreekPortfolio);
registerView('projects',        renderPM);

// Nav click handlers
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
  const examDays = Math.ceil((new Date('2026-05-05') - new Date()) / 86400000);
  examCountdownEl.textContent = examDays >= 0 ? `T-${examDays}` : 'DONE';
}

initRouter('dashboard');
