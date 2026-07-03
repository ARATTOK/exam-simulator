/* ============================================
   SimuExam — API Client (Express backend)
   ============================================ */

const API_URL = 'https://exam-simulator-d1kr.onrender.com';

let apiToken = null;
let apiReady = false;

function setApiToken(token) {
  apiToken = token;
  localStorage.setItem('simuexam-token', token);
}

function getApiToken() {
  if (!apiToken) apiToken = localStorage.getItem('simuexam-token');
  return apiToken;
}

function clearApiToken() {
  apiToken = null;
  localStorage.removeItem('simuexam-token');
}

async function apiRequest(method, path, body) {
  const token = getApiToken();
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const opts = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  opts.signal = controller.signal;

  try {
    const res = await fetch(API_URL + path, opts);
    clearTimeout(timeout);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('El servidor no responde (timeout). El backend en Render se duerme si no se usa. Abre https://exam-simulator-d1kr.onrender.com/api/health en tu navegador para despertarlo.');
    }
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('No se puede conectar al servidor. Verifica que el backend esté activo.');
    }
    throw err;
  }
}

function apiGet(path) { return apiRequest('GET', path); }
function apiPost(path, body) { return apiRequest('POST', path, body); }
function apiPut(path, body) { return apiRequest('PUT', path, body); }
function apiDelete(path) { return apiRequest('DELETE', path); }

async function apiUpload(file) {
  const token = getApiToken();
  const form = new FormData();
  form.append('file', file);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const opts = { method: 'POST', body: form, signal: controller.signal };
  if (token) opts.headers = { 'Authorization': 'Bearer ' + token };

  try {
    const res = await fetch(API_URL + '/api/upload', opts);
    clearTimeout(timeout);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al subir');
    return data.url;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Timeout al subir imagen');
    throw err;
  }
}
