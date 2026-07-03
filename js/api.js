/* ============================================
   SimuExam — API Client (Express backend)
   ============================================ */

// ⚠️ CONFIGURA AQUÍ LA URL DE TU BACKEND
const API_URL = 'https://exam-simulator-d1kr.onrender.com';

let apiToken = null;

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
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API_URL + path, opts);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

function apiGet(path) { return apiRequest('GET', path); }
function apiPost(path, body) { return apiRequest('POST', path, body); }
function apiPut(path, body) { return apiRequest('PUT', path, body); }
function apiDelete(path) { return apiRequest('DELETE', path); }

async function apiUpload(file) {
  const token = getApiToken();
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(API_URL + '/api/upload', {
    method: 'POST',
    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al subir');
  return data.url;
}
