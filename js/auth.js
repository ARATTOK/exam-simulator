/* ============================================
   SimuExam — Autenticación (API backend)
   ============================================ */

let currentUser = null;

async function checkSession() {
  const token = getApiToken();
  if (!token) return null;

  try {
    const user = await apiGet('/api/auth/me');
    currentUser = user;
    return { user, profile: user };
  } catch {
    clearApiToken();
    return null;
  }
}

async function login(email, password) {
  const data = await apiPost('/api/auth/login', { email, password });
  setApiToken(data.token);
  currentUser = data.user;
  return { user: data.user, profile: data.user };
}

async function register(email, password, displayName, role, secret) {
  const data = await apiPost('/api/auth/register', {
    email, password, displayName, role,
    secret: role === 'admin' ? secret : undefined,
  });
  setApiToken(data.token);
  currentUser = data.user;
  return { user: data.user, profile: data.user };
}

async function logout() {
  clearApiToken();
  currentUser = null;
  window.location.href = 'index.html';
}

function isAdmin() {
  return currentUser?.role === 'admin';
}
