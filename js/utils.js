/* ============================================
   SimuExam — Utilidades y configuración
   ============================================ */

// --- Configuración de diseño ---
const DESIGN_KEY = 'simuexam-selected-design';

const designs = {
  a: {
    name: 'Académico Clásico',
    colors: {
      primary: '#4F46E5',
      secondary: '#6366F1',
      bg: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#1E293B',
      textSecondary: '#64748B',
      accent: '#10B981',
      border: '#E2E8F0',
    },
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    radius: '8px',
    mode: 'light',
  },
  b: {
    name: 'Moderno Oscuro',
    colors: {
      primary: '#10B981',
      secondary: '#34D399',
      bg: '#0F172A',
      surface: '#1E293B',
      text: '#E2E8F0',
      textSecondary: '#64748B',
      accent: '#10B981',
      border: 'rgba(255,255,255,0.1)',
    },
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    radius: '12px',
    mode: 'dark',
  },
  c: {
    name: 'Playful Gradiente',
    colors: {
      primary: '#8B5CF6',
      secondary: '#EC4899',
      bg: '#FFF1F2',
      surface: '#FFFFFF',
      text: '#1E293B',
      textSecondary: '#71717A',
      accent: '#EC4899',
      border: '#FECDD3',
    },
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    radius: '20px',
    mode: 'light',
  },
};

// Default to Design A
const DEFAULT_DESIGN = 'a';

function getSelectedDesign() {
  return localStorage.getItem(DESIGN_KEY) || DEFAULT_DESIGN;
}

function setSelectedDesign(designId) {
  localStorage.setItem(DESIGN_KEY, designId);
}

function getDesignConfig(designId) {
  return designs[designId] || designs[DEFAULT_DESIGN];
}

// --- Admin config ---
const ADMIN_SECRET = 'simu-admin-2026';

// --- UI Helpers ---
function $(sel, ctx) { return (ctx || document).querySelector(sel); }

function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

function show(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.classList.remove('hidden');
}

function hide(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.classList.add('hidden');
}

function html(el, content) {
  if (el) el.innerHTML = content;
}

function toggleLoading(show) {
  const el = $('#loadingIndicator');
  if (el) {
    if (show) { el.classList.remove('hidden'); } else { el.classList.add('hidden'); }
  }
}

// --- Shuffle (Fisher-Yates) ---
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Timer formatting ---
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// --- File reading ---
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function parseJSONorCSV(text) {
  // Try JSON first
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    return null;
  } catch (_) {}

  // Try CSV
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i]; });
    return obj;
  });
}

// --- Modal helper ---
function openModal(id) {
  $(id).classList.add('open');
}

function closeModal(id) {
  $(id).classList.remove('open');
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// --- Esc key closes modals ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $$('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// --- HTML escape ---
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// --- Toast notifications ---
function toast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = message;

  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function toastSuccess(msg) { toast(msg, 'success'); }
function toastError(msg) { toast(msg, 'error'); }
function toastInfo(msg) { toast(msg, 'info'); }

// --- Theme toggle ---
function getTheme() {
  return localStorage.getItem('simuexam-theme') || 'light';
}

function setTheme(theme) {
  localStorage.setItem('simuexam-theme', theme);
  document.documentElement.classList.add('theme-transitioning');
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
  setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
}

function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function initTheme() {
  setTheme(getTheme());
}

function initIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}
