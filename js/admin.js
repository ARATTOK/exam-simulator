/* ============================================
   SimuExam — Admin CRUD (API backend)
   ============================================ */

let adminState = {
  categories: [],
  topics: [],
  currentCategoryId: null,
};

// --- Categories ---
async function loadCategories() {
  const data = await apiGet('/api/categories');
  adminState.categories = data || [];
  return data;
}

function renderCategories() {
  const tbody = $('#categoriesTable tbody');
  if (!tbody) return;
  if (!adminState.categories.length) {
    html(tbody, '<tr><td colspan="4" class="text-center" style="padding:32px;color:var(--text-muted);">No hay categorías. Crea la primera.</td></tr>');
    return;
  }
  html(tbody, adminState.categories.map(c => `
    <tr>
      <td><strong>${esc(c.name)}</strong></td>
      <td class="text-muted">${esc(c.description || '—')}</td>
      <td><span class="badge badge-primary">${c.topic_count || 0} temas</span></td>
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
  if (!name) return showFormError('catFormError', 'El nombre es obligatorio');

  try {
    if (id) {
      await apiPut('/api/categories/' + id, { name, description: desc });
    } else {
      await apiPost('/api/categories', { name, description: desc });
    }
  } catch (err) {
    return showFormError('catFormError', err.message);
  }
  closeModal('#categoryModal');
  await loadCategories();
  renderCategories();
}

function editCategory(id) {
  const c = adminState.categories.find(x => x.id === id);
  if (!c) return;
  $('#catId').value = c.id;
  $('#catName').value = c.name;
  $('#catDesc').value = c.description || '';
  $('#catModalTitle').textContent = 'Editar categoría';
  $('#catFormError').style.display = 'none';
  openModal('#categoryModal');
}

async function deleteCategory(id) {
  if (!confirm('¿Eliminar esta categoría? También se eliminarán todas sus preguntas.')) return;
  try {
    await apiDelete('/api/categories/' + id);
  } catch (err) { return alert('Error: ' + err.message); }
  await loadCategories();
  renderCategories();
}

function resetCategoryForm() {
  $('#catId').value = '';
  $('#catName').value = '';
  $('#catDesc').value = '';
  $('#catModalTitle').textContent = 'Nueva categoría';
  $('#catFormError').style.display = 'none';
}

// --- Topics ---
async function loadTopics(categoryId) {
  if (!categoryId) return [];
  const data = await apiGet('/api/topics?category_id=' + categoryId);
  adminState.topics = data || [];
  return data;
}

function renderTopics() {
  const tbody = $('#topicsTable tbody');
  if (!tbody) return;
  if (!adminState.topics.length) {
    html(tbody, '<tr><td colspan="3" class="text-center" style="padding:32px;color:var(--text-muted);">No hay temas en esta categoría.</td></tr>');
    return;
  }
  html(tbody, adminState.topics.map(t => `
    <tr>
      <td><strong>${esc(t.name)}</strong></td>
      <td><span class="badge badge-primary">${t.question_count || 0} preguntas</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-secondary" onclick="editTopic('${t.id}')">✎</button>
          <button class="btn btn-sm btn-danger" onclick="deleteTopic('${t.id}')">✕</button>
        </div>
      </td>
    </tr>
  `).join(''));
}

async function saveTopic() {
  const id = $('#topicId').value;
  const name = $('#topicName').value.trim();
  if (!name) return showFormError('topicFormError', 'El nombre es obligatorio');
  if (!adminState.currentCategoryId) return showFormError('topicFormError', 'Selecciona una categoría');

  try {
    if (id) {
      await apiPut('/api/topics/' + id, { name });
    } else {
      await apiPost('/api/topics', { name, category_id: adminState.currentCategoryId });
    }
  } catch (err) { return showFormError('topicFormError', err.message); }
  closeModal('#topicModal');
  await loadTopics(adminState.currentCategoryId);
  renderTopics();
}

function editTopic(id) {
  const t = adminState.topics.find(x => x.id === id);
  if (!t) return;
  $('#topicId').value = t.id;
  $('#topicName').value = t.name;
  $('#topicModalTitle').textContent = 'Editar tema';
  $('#topicFormError').style.display = 'none';
  openModal('#topicModal');
}

async function deleteTopic(id) {
  if (!confirm('¿Eliminar este tema?')) return;
  try { await apiDelete('/api/topics/' + id); } catch (err) { return alert('Error: ' + err.message); }
  await loadTopics(adminState.currentCategoryId);
  renderTopics();
}

function resetTopicForm() {
  $('#topicId').value = '';
  $('#topicName').value = '';
  $('#topicModalTitle').textContent = 'Nuevo tema';
  $('#topicFormError').style.display = 'none';
}

// --- Questions ---
async function loadQuestions(topicId) {
  let path = '/api/questions?category_id=' + adminState.currentCategoryId;
  if (topicId) path += '&topic_id=' + topicId;
  return await apiGet(path);
}

function renderQuestions(questions) {
  const tbody = $('#questionsTable tbody');
  if (!tbody) return;
  if (!questions.length) {
    html(tbody, '<tr><td colspan="5" class="text-center" style="padding:32px;color:var(--text-muted);">No hay preguntas.</td></tr>');
    return;
  }
  html(tbody, questions.map(q => {
    const correctCount = (q.answers || []).filter(a => a.is_correct).length;
    const totalCount = (q.answers || []).length;
    return `
    <tr>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(q.text)}</td>
      <td>${q.image_url ? '<span class="badge badge-primary">📷</span>' : '<span class="text-muted">—</span>'}</td>
      <td><span class="badge ${correctCount > 0 ? 'badge-success' : 'badge-error'}">${correctCount}/${totalCount}</span></td>
      <td><span class="text-muted" style="font-size:0.8rem;">${esc(q.topic_name || '—')}</span></td>
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
  if (!text) return showFormError('qFormError', 'El texto de la pregunta es obligatorio');
  if (!adminState.currentCategoryId) return showFormError('qFormError', 'Selecciona una categoría');

  const topicId = $('#qTopic').value || null;
  const imageUrl = $('#qImage').value.trim() || null;
  const explanation = $('#qExplanation').value.trim() || null;

  try {
    let questionId = id;
    if (id) {
      await apiPut('/api/questions/' + id, { topic_id: topicId, text, image_url: imageUrl, explanation });
    } else {
      const q = await apiPost('/api/questions', { category_id: adminState.currentCategoryId, topic_id: topicId, text, image_url: imageUrl, explanation });
      questionId = q.id;
    }

    // Save answers
    const answerEls = $$('#answersContainer .answer-row');
    const answers = [];
    for (const row of answerEls) {
      const answerText = row.querySelector('.answer-text').value.trim();
      const isCorrect = row.querySelector('.answer-correct').checked;
      if (answerText) answers.push({ text: answerText, is_correct: isCorrect });
    }

    await apiPut('/api/questions/' + questionId + '/answers', { answers });
  } catch (err) { return showFormError('qFormError', err.message); }

  closeModal('#questionModal');
  await refreshQuestions();
}

function editQuestion(id) {
  apiGet('/api/questions?category_id=' + adminState.currentCategoryId).then(questions => {
    const q = questions.find(x => x.id === id);
    if (!q) return;
    $('#qId').value = q.id;
    $('#qText').value = q.text;
    $('#qExplanation').value = q.explanation || '';
    $('#qImage').value = q.image_url || '';
    populateTopicSelect(q.topic_id || '');
    $('#qModalTitle').textContent = 'Editar pregunta';
    $('#qFormError').style.display = 'none';
    renderAnswerRows(q.answers || []);
    openModal('#questionModal');
  });
}

async function deleteQuestion(id) {
  if (!confirm('¿Eliminar esta pregunta permanentemente?')) return;
  try { await apiDelete('/api/questions/' + id); } catch (err) { return alert('Error: ' + err.message); }
  await refreshQuestions();
}

function resetQuestionForm() {
  $('#qId').value = '';
  $('#qText').value = '';
  $('#qExplanation').value = '';
  $('#qImage').value = '';
  $('#qModalTitle').textContent = 'Nueva pregunta';
  $('#qFormError').style.display = 'none';
  renderAnswerRows([]);
  populateTopicSelect('');
}

function renderAnswerRows(answers) {
  const container = $('#answersContainer');
  if (!answers.length) answers = [{ text: '', is_correct: false }];
  html(container, answers.map((a, i) => `
    <div class="answer-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
      <input type="checkbox" class="answer-correct" ${a.is_correct ? 'checked' : ''} style="width:22px;height:22px;">
      <input type="text" class="answer-text form-input" value="${esc(a.text)}" placeholder="Texto de la respuesta" style="flex:1;">
      <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.answer-row').remove()">✕</button>
    </div>
  `).join(''));
}

function addAnswerRow() {
  const container = $('#answersContainer');
  const i = container.children.length + 1;
  const div = document.createElement('div');
  div.className = 'answer-row';
  div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';
  div.innerHTML = `
    <input type="checkbox" class="answer-correct" style="width:22px;height:22px;">
    <input type="text" class="answer-text form-input" placeholder="Texto de la respuesta" style="flex:1;">
    <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.answer-row').remove()">✕</button>
  `;
  container.appendChild(div);
}

function populateTopicSelect(selected) {
  const sel = $('#qTopic');
  if (!sel) return;
  html(sel, `<option value="">Sin tema</option>
    ${adminState.topics.map(t => `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}`);
}

// --- Questions filter ---
async function filterQuestionsByTopic() {
  const topicId = $('#questionTopicFilter').value;
  const questions = await loadQuestions(topicId || null);
  renderQuestions(questions);
}

// --- Image upload ---
async function uploadImageFile(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const url = await apiUpload(file);
    $('#qImage').value = url;
    alert('✅ Imagen subida con éxito');
  } catch (err) {
    alert('Error al subir imagen: ' + err.message);
  }
}

// --- Import ---
async function handleImport(file) {
  const text = await readFileAsText(file);
  const data = parseJSONorCSV(text);
  if (!data) throw new Error('Formato inválido. Usa JSON o CSV.');

  let imported = 0;

  for (const item of data) {
    const catName = item.category || item.categoria;
    if (!catName) continue;

    // Find or create category
    let cat = adminState.categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
    if (!cat) {
      cat = await apiPost('/api/categories', { name: catName });
      adminState.categories.push(cat);
    }

    const questionText = item.question || item.pregunta || item.text;
    if (!questionText) continue;

    const explanation = item.explanation || item.explicacion || '';
    const imageUrl = item.image || item.imagen || '';

    const q = await apiPost('/api/questions', {
      category_id: cat.id,
      text: questionText,
      explanation,
      image_url: imageUrl,
    });

    // Parse answers
    const answers = [];
    for (let i = 1; i <= 6; i++) {
      const answerText = item['answer' + i] || item['respuesta' + i] || item['option' + i] || '';
      if (!answerText) continue;
      const isCorrect = item['correct' + i] === 'true' || item['correct' + i] === 'yes' || item['correct' + i] === '1'
        || item['correct' + i] === true || item['correcta' + i] === 'true';
      answers.push({ text: answerText, is_correct: isCorrect });
    }

    if (answers.length > 0) {
      await apiPut('/api/questions/' + q.id + '/answers', { answers });
    }
    imported++;
  }
  return imported;
}

async function refreshQuestions() {
  const questions = await loadQuestions(adminState.currentTopicId);
  renderQuestions(questions);
}

// --- Category selection ---
function renderCategorySelect() {
  const container = $('#categoriesTable tbody');
  if (!container) return;
  if (!adminState.categories.length) {
    html(container, '<tr><td colspan="4" class="text-center" style="padding:32px;color:var(--text-muted);">No hay categorías. Crea la primera.</td></tr>');
    return;
  }
  html(container, adminState.categories.map(c => `
    <tr style="cursor:pointer;" onclick="onCategoryChange('${c.id}')">
      <td><strong>${esc(c.name)}</strong></td>
      <td class="text-muted">${esc(c.description || '—')}</td>
      <td><span class="badge badge-primary">${c.topic_count || 0} temas</span></td>
      <td onclick="event.stopPropagation()">
        <div class="table-actions">
          <button class="btn btn-sm btn-secondary" onclick="editCategory('${c.id}')">✎</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCategory('${c.id}')">✕</button>
        </div>
      </td>
    </tr>
  `).join(''));
}

async function onCategoryChange(categoryId) {
  adminState.currentCategoryId = categoryId;
  if (categoryId) {
    await loadTopics(categoryId);
    renderTopics();
    await refreshQuestions();
    const cat = adminState.categories.find(c => c.id === categoryId);
    if (cat) {
      $('#currentCategoryName').textContent = cat.name;
      $('#currentCategoryName2').textContent = cat.name;
    }
    // Populate topic filter
    const filter = $('#questionTopicFilter');
    if (filter) {
      html(filter, `<option value="">Todos los temas</option>
        ${adminState.topics.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}`);
    }
    $$('.admin-tab').forEach(t => t.classList.remove('hidden'));
  } else {
    adminState.topics = [];
    renderTopics();
    renderQuestions([]);
    $$('.admin-tab').forEach(t => t.classList.add('hidden'));
  }
}

function showFormError(elId, msg) {
  const el = $(`#${elId}`);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}


