// adminState is declared globally in admin.html inline script

// ==========================================
// CATEGORIES
// ==========================================

async function loadCategories() {
  const data = await apiGet('/api/categories');
  adminState.categories = data || [];
}

function renderCategories() {
  const tbody = $('#categoriesTable tbody');
  if (!tbody) return;
  if (!adminState.categories.length) {
    html(tbody, '<tr><td colspan="4" class="text-center" style="padding:32px;color:var(--text-muted);">No hay categorías.</td></tr>');
    return;
  }
  html(tbody, adminState.categories.map(c => `
    <tr>
      <td><strong>${esc(c.name)}</strong></td>
      <td class="text-muted">${esc(c.description || '—')}</td>
      <td><span class="badge badge-primary">${c.exam_count || 0} exámenes</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-secondary" onclick="editCategory('${c.id}')">✎</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCategory('${c.id}')">✕</button>
        </div>
      </td>
    </tr>
  `).join(''));
}

async function saveCategory() {
  const id = $('#catId').value;
  const name = $('#catName').value.trim();
  const desc = $('#catDesc').value.trim();
  if (!name) return toastError('El nombre es obligatorio');
  try {
    if (id) {
      await apiPut('/api/categories/' + id, { name, description: desc });
    } else {
      await apiPost('/api/categories', { name, description: desc });
    }
  } catch (err) { return toastError(err.message); }
  closeModal('#categoryModal');
  await loadCategories();
  renderCategories();
  toastSuccess(id ? 'Categoría actualizada' : 'Categoría creada');
}

function editCategory(id) {
  const c = adminState.categories.find(x => x.id === id);
  if (!c) return;
  $('#catId').value = c.id;
  $('#catName').value = c.name;
  $('#catDesc').value = c.description || '';
  $('#catModalTitle').textContent = 'Editar categoría';
  openModal('#categoryModal');
}

async function deleteCategory(id) {
  if (!confirm('¿Eliminar esta categoría?')) return;
  try { await apiDelete('/api/categories/' + id); } catch (err) { return toastError(err.message); }
  await loadCategories();
  renderCategories();
  toastSuccess('Categoría eliminada');
}

function resetCategoryForm() {
  $('#catId').value = '';
  $('#catName').value = '';
  $('#catDesc').value = '';
  $('#catModalTitle').textContent = 'Nueva categoría';
}

// ==========================================
// EXAM DEFINITIONS
// ==========================================

async function loadExams() {
  const data = await apiGet('/api/exam-definitions');
  adminState.exams = data || [];
}

function renderExams() {
  const container = $('#examsTable tbody');
  if (!container) return;
  if (!adminState.exams.length) {
    html(container, '<tr><td colspan="5" class="text-center" style="padding:32px;color:var(--text-muted);">No hay exámenes. Crea el primero.</td></tr>');
    return;
  }
  html(container, adminState.exams.map(e => `
    <tr style="cursor:pointer;" class="${e.id === adminState.currentExamId ? 'selected' : ''}" onclick="selectExam('${e.id}')">
      <td><strong>${esc(e.name)}</strong></td>
      <td class="text-muted">${esc(e.category_name || '—')}</td>
      <td><span class="badge badge-primary">${e.topic_count || 0} temas</span></td>
      <td><span class="badge badge-primary">${e.question_count || 0} preguntas</span></td>
      <td onclick="event.stopPropagation()">
        <div class="table-actions">
          <button class="btn btn-sm btn-secondary" onclick="editExam('${e.id}')">✎</button>
          <button class="btn btn-sm btn-danger" onclick="deleteExam('${e.id}')">✕</button>
        </div>
      </td>
    </tr>
  `).join(''));
}

function selectExam(examId) {
  adminState.currentExamId = examId;
  renderExams();
  const exam = adminState.exams.find(e => e.id === examId);
  if (exam) {
    $('#examDetailName').textContent = exam.name;
    $('#examDetailInfo').textContent = `${exam.question_count || 0} preguntas · ${exam.topic_count || 0} temas`;
  }
  show('#examDetail');
  show('#examSubTabs');
  loadExamTopics(examId);
}

function deselectExam() {
  adminState.currentExamId = null;
  adminState.currentTopicId = null;
  hide('#examDetail');
  hide('#examSubTabs');
  hide('#topicDetail');
  renderExams();
}

async function saveExam() {
  const id = $('#examId').value;
  const name = $('#examName').value.trim();
  const desc = $('#examDesc').value.trim();
  const category_id = $('#examCategory').value || null;
  const passing_score = parseFloat($('#examPassingScore').value) || 70;
  const suggested_minutes = parseInt($('#examMinutes').value) || 0;
  const official_url = $('#examUrl').value.trim() || null;
  if (!name) return toastError('El nombre es obligatorio');

  try {
    if (id) {
      await apiPut('/api/exam-definitions/' + id, { name, description: desc, category_id, passing_score, suggested_minutes, official_url });
    } else {
      await apiPost('/api/exam-definitions', { name, description: desc, category_id, passing_score, suggested_minutes, official_url });
    }
  } catch (err) { return toastError(err.message); }
  closeModal('#examModal');
  await loadExams();
  renderExams();
  toastSuccess(id ? 'Examen actualizado' : 'Examen creado');
}

function editExam(id) {
  const e = adminState.exams.find(x => x.id === id);
  if (!e) return;
  $('#examId').value = e.id;
  $('#examName').value = e.name;
  $('#examDesc').value = e.description || '';
  $('#examCategory').value = e.category_id || '';
  $('#examPassingScore').value = e.passing_score || 70;
  $('#examMinutes').value = e.suggested_minutes || 0;
  $('#examUrl').value = e.official_url || '';
  $('#examModalTitle').textContent = 'Editar examen';
  openModal('#examModal');
}

function resetExamForm() {
  $('#examId').value = '';
  $('#examName').value = '';
  $('#examDesc').value = '';
  $('#examCategory').value = '';
  $('#examPassingScore').value = 70;
  $('#examMinutes').value = 0;
  $('#examUrl').value = '';
  $('#examModalTitle').textContent = 'Nuevo examen';
  populateExamCategorySelect();
}

function populateExamCategorySelect() {
  const sel = $('#examCategory');
  if (!sel) return;
  html(sel, `<option value="">Sin categoría</option>
    ${adminState.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}`);
}

async function deleteExam(id) {
  if (!confirm('¿Eliminar este examen? También se eliminarán todas sus preguntas.')) return;
  try { await apiDelete('/api/exam-definitions/' + id); } catch (err) { return toastError(err.message); }
  if (adminState.currentExamId === id) deselectExam();
  await loadExams();
  renderExams();
  toastSuccess('Examen eliminado');
}

// ==========================================
// EXAM TOPICS
// ==========================================

async function loadExamTopics(examId) {
  if (!examId) { adminState.topics = []; renderExamTopics(); return; }
  const data = await apiGet(`/api/exam-definitions/${examId}/topics`);
  adminState.topics = data || [];
  renderExamTopics();
}

function renderExamTopics() {
  const container = $('#examTopicsList');
  if (!container) return;
  if (!adminState.topics.length) {
    html(container, '<div class="text-muted text-sm" style="padding:12px;text-align:center;">No hay temas. Crea el primero.</div>');
    return;
  }
  html(container, adminState.topics.map(t => `
    <div class="topic-item ${t.id === adminState.currentTopicId ? 'selected' : ''}" onclick="selectTopic('${t.id}')">
      <div class="topic-item-name">${esc(t.name)}</div>
      <div class="topic-item-count">${t.question_count || 0} preguntas</div>
      <div class="topic-item-actions">
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();editTopic('${t.id}')">✎</button>
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteTopic('${t.id}')">✕</button>
      </div>
    </div>
  `).join(''));
}

function selectTopic(topicId) {
  adminState.currentTopicId = topicId;
  renderExamTopics();
  if (topicId) {
    const topic = adminState.topics.find(t => t.id === topicId);
    $('#topicDetailName').textContent = topic ? topic.name : '';
    show('#topicDetail');
    show('#topicQuestionActions');
    loadTopicQuestions(topicId);
  } else {
    hide('#topicDetail');
  }
}

async function saveExamTopic() {
  const id = $('#topicId').value;
  const name = $('#topicName').value.trim();
  if (!name) return toastError('El nombre es obligatorio');
  if (!adminState.currentExamId) return toastError('Selecciona un examen');
  try {
    if (id) {
      await apiPut('/api/exam-topics/' + id, { name });
    } else {
      await apiPost('/api/exam-topics', { name, exam_definition_id: adminState.currentExamId });
    }
  } catch (err) { return toastError(err.message); }
  closeModal('#topicModal');
  await loadExamTopics(adminState.currentExamId);
  toastSuccess(id ? 'Tema actualizado' : 'Tema creado');
}

function editTopic(id) {
  const t = adminState.topics.find(x => x.id === id);
  if (!t) return;
  $('#topicId').value = t.id;
  $('#topicName').value = t.name;
  $('#topicModalTitle').textContent = 'Editar tema';
  openModal('#topicModal');
}

function resetTopicForm() {
  $('#topicId').value = '';
  $('#topicName').value = '';
  $('#topicModalTitle').textContent = 'Nuevo tema';
}

async function deleteTopic(id) {
  if (!confirm('¿Eliminar este tema?')) return;
  try { await apiDelete('/api/exam-topics/' + id); } catch (err) { return toastError(err.message); }
  if (adminState.currentTopicId === id) {
    adminState.currentTopicId = null;
    hide('#topicDetail');
  }
  await loadExamTopics(adminState.currentExamId);
  toastSuccess('Tema eliminado');
}

// ==========================================
// EXAM QUESTIONS
// ==========================================

async function loadTopicQuestions(topicId) {
  if (!topicId) { renderTopicQuestions([]); return; }
  const data = await apiGet(`/api/exam-topics/${topicId}/questions`);
  renderTopicQuestions(data || []);
}

function renderTopicQuestions(questions) {
  const container = $('#questionsBody');
  if (!container) return;
  if (!questions.length) {
    html(container, '<tr><td colspan="5" class="text-center" style="padding:32px;color:var(--text-muted);">No hay preguntas en este tema.</td></tr>');
    return;
  }
  html(container, questions.map(q => {
    const correctCount = (q.options || []).filter(o => o.is_correct).length;
    const totalCount = (q.options || []).length;
    return `
    <tr>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(q.text)}</td>
      <td>${q.image_url ? '<span class="badge badge-primary">📷</span>' : '<span class="text-muted">—</span>'}</td>
      <td><span class="badge ${correctCount > 0 ? 'badge-success' : 'badge-error'}">${correctCount}/${totalCount}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-secondary" onclick="editQuestion('${q.id}')">✎</button>
          <button class="btn btn-sm btn-danger" onclick="deleteQuestion('${q.id}')">✕</button>
        </div>
      </td>
    </tr>`;
  }).join(''));
}

async function saveQuestion() {
  const id = $('#qId').value;
  const text = $('#qText').value.trim();
  if (!text) return toastError('El texto de la pregunta es obligatorio');
  if (!adminState.currentTopicId) return toastError('Selecciona un tema');

  const imageUrl = $('#qImage').value.trim() || null;
  const explanation = $('#qExplanation').value.trim() || null;

  try {
    let questionId = id;
    if (id) {
      await apiPut('/api/exam-questions/' + id, { text, image_url: imageUrl, explanation });
    } else {
      const q = await apiPost('/api/exam-questions', { exam_topic_id: adminState.currentTopicId, text, image_url: imageUrl, explanation });
      questionId = q.id;
    }

    const optionEls = $$('#optionsContainer .option-row');
    const options = [];
    for (const row of optionEls) {
      const optText = row.querySelector('.option-text').value.trim();
      const isCorrect = row.querySelector('.option-correct').checked;
      if (optText) options.push({ text: optText, is_correct: isCorrect });
    }

    await apiPut('/api/exam-questions/' + questionId + '/options', { options });
  } catch (err) { return toastError(err.message); }

  closeModal('#questionModal');
  await loadTopicQuestions(adminState.currentTopicId);
  toastSuccess(id ? 'Pregunta actualizada' : 'Pregunta creada');
}

function editQuestion(id) {
  apiGet(`/api/exam-topics/${adminState.currentTopicId}/questions`).then(questions => {
    const q = questions.find(x => x.id === id);
    if (!q) return;
    $('#qId').value = q.id;
    $('#qText').value = q.text;
    $('#qExplanation').value = q.explanation || '';
    $('#qImage').value = q.image_url || '';
    $('#qModalTitle').textContent = 'Editar pregunta';
    renderOptionRows(q.options || []);
    openModal('#questionModal');
  });
}

function resetQuestionForm() {
  $('#qId').value = '';
  $('#qText').value = '';
  $('#qExplanation').value = '';
  $('#qImage').value = '';
  $('#qModalTitle').textContent = 'Nueva pregunta';
  renderOptionRows([]);
}

function renderOptionRows(options) {
  const container = $('#optionsContainer');
  if (!options.length) options = [{ text: '', is_correct: false }];
  html(container, options.map((o, i) => `
    <div class="option-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
      <input type="checkbox" class="option-correct" ${o.is_correct ? 'checked' : ''} style="width:22px;height:22px;">
      <input type="text" class="option-text form-input" value="${esc(o.text)}" placeholder="Texto de la opción" style="flex:1;">
      <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.option-row').remove()">✕</button>
    </div>
  `).join(''));
}

function addOptionRow() {
  const container = $('#optionsContainer');
  const div = document.createElement('div');
  div.className = 'option-row';
  div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';
  div.innerHTML = `
    <input type="checkbox" class="option-correct" style="width:22px;height:22px;">
    <input type="text" class="option-text form-input" placeholder="Texto de la opción" style="flex:1;">
    <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.option-row').remove()">✕</button>
  `;
  container.appendChild(div);
}

async function deleteQuestion(id) {
  if (!confirm('¿Eliminar esta pregunta permanentemente?')) return;
  try { await apiDelete('/api/exam-questions/' + id); } catch (err) { return toastError(err.message); }
  await loadTopicQuestions(adminState.currentTopicId);
  toastSuccess('Pregunta eliminada');
}

// ==========================================
// IMPORT
// ==========================================

async function handleImportFile(file) {
  if (!adminState.currentExamId) return toastError('Selecciona un examen primero');
  try {
    const text = await readFileAsText(file);
    const data = parseJSONorCSV(text);
    if (!data) throw new Error('Formato inválido. Usa JSON o CSV.');
    const result = await apiPost(`/api/exam-definitions/${adminState.currentExamId}/import`, { items: data });
    toastSuccess(result.imported + ' preguntas importadas correctamente.');
    await loadExamTopics(adminState.currentExamId);
    if (adminState.currentTopicId) await loadTopicQuestions(adminState.currentTopicId);
  } catch (err) {
    toastError(err.message);
  }
}

// ==========================================
// IMAGE UPLOAD
// ==========================================

async function uploadImageFile(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const url = await apiUpload(file);
    $('#qImage').value = url;
    toastSuccess('Imagen subida con éxito');
  } catch (err) {
    toastError('Error al subir imagen: ' + err.message);
  }
}

// ==========================================
// TAB SYSTEM
// ==========================================

// ==========================================
// USERS
// ==========================================

async function loadUsers() {
  try {
    const users = await apiGet('/api/admin/users');
    const tbody = $('#usersTable tbody');
    if (!users.length) {
      html(tbody, '<tr><td colspan="4" class="text-center" style="padding:32px;color:var(--text-muted);">No hay usuarios.</td></tr>');
      return;
    }
    html(tbody, users.map(u => `
      <tr>
        <td>${esc(u.email)}</td>
        <td>${esc(u.display_name || '—')}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-success'}">${u.role}</span></td>
        <td class="text-muted text-sm">${new Date(u.created_at).toLocaleDateString('es-ES')}</td>
      </tr>
    `).join(''));
  } catch (err) {
    toastError('Error al cargar usuarios: ' + err.message);
  }
}

async function saveUser() {
  const email = $('#userEmail').value.trim();
  const password = $('#userPassword').value;
  const displayName = $('#userName').value.trim();
  const role = $('#userRole').value;
  if (!email || !password) return toastError('Email y contraseña requeridos');

  try {
    await apiPost('/api/admin/users', { email, password, displayName, role });
    closeModal('#userModal');
    toastSuccess('Usuario creado correctamente');
    loadUsers();
  } catch (err) {
    toastError(err.message);
  }
}

function resetUserForm() {
  $('#userEmail').value = '';
  $('#userPassword').value = '';
  $('#userName').value = '';
  $('#userRole').value = 'user';
}

// switchTab is defined in admin.html inline script
