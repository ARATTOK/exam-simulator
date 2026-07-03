const EXAM_STATE_KEY = 'simuexam-current-exam';
let examState = null;
let examTimerInterval = null;
let currentQuestionData = null;

async function initExam(examDefinitionId, mode, questionCount) {
  const questions = await loadExamQuestions(examDefinitionId);
  if (!questions || questions.length === 0) throw new Error('No hay preguntas disponibles para este examen.');

  const count = questionCount && questionCount < questions.length ? questionCount : questions.length;
  const selected = shuffle(questions).slice(0, count);

  const session = await apiPost('/api/exam-sessions', {
    exam_definition_id: examDefinitionId,
    mode,
    question_count: count,
  });

  examState = {
    sessionId: session.id,
    examDefinitionId,
    mode,
    allQuestions: selected,
    mastered: new Set(),
    currentCycle: shuffle([...selected]),
    cycleIndex: 0,
    cycleNumber: 1,
    score: 0,
    totalQuestions: count,
    startTime: Date.now(),
    elapsedSeconds: 0,
    completed: false,
  };

  saveExamState();
  return examState;
}

async function loadExamQuestions(examDefinitionId) {
  const topics = await apiGet(`/api/exam-definitions/${examDefinitionId}/topics`);
  let all = [];
  for (const topic of topics) {
    const questions = await apiGet(`/api/exam-topics/${topic.id}/questions`);
    all = all.concat(questions);
  }
  return all;
}

function loadExamState() {
  const saved = localStorage.getItem(EXAM_STATE_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    parsed.mastered = new Set(parsed.mastered);
    examState = parsed;
    return examState;
  } catch {
    localStorage.removeItem(EXAM_STATE_KEY);
    return null;
  }
}

function saveExamState() {
  if (!examState) return;
  const toSave = { ...examState, mastered: Array.from(examState.mastered) };
  localStorage.setItem(EXAM_STATE_KEY, JSON.stringify(toSave));
}

function clearExamState() {
  localStorage.removeItem(EXAM_STATE_KEY);
  examState = null;
}

function getCurrentQuestion() {
  if (!examState || examState.completed) return null;
  const cycle = examState.currentCycle;
  if (examState.cycleIndex >= cycle.length) return null;
  const q = cycle[examState.cycleIndex];
  if (!q) return null;
  const shuffledOptions = shuffle(q.options || []);
  currentQuestionData = { ...q, options: shuffledOptions };
  return currentQuestionData;
}

async function submitAnswer(selectedOptionIds) {
  if (!examState || examState.completed) return null;
  const q = examState.currentCycle[examState.cycleIndex];
  if (!q) return null;

  const correctIds = (q.options || []).filter(o => o.is_correct).map(o => o.id);
  const isCorrect = arraysEqual(selectedOptionIds.sort(), correctIds.sort());

  await apiPost('/api/session-answers', {
    session_id: examState.sessionId,
    exam_question_id: q.id,
    selected_option_ids: selectedOptionIds,
    is_correct: isCorrect,
    cycle_number: examState.cycleNumber,
  });

  if (isCorrect) { examState.mastered.add(q.id); examState.score++; }

  examState.cycleIndex++;
  saveExamState();

  if (examState.cycleIndex >= examState.currentCycle.length) {
    return await startNextCycle();
  }
  return { isCorrect, done: false, correctIds };
}

async function startNextCycle() {
  const pending = examState.allQuestions.filter(q => !examState.mastered.has(q.id));
  if (pending.length === 0) return await finishExam();

  examState.cycleNumber++;
  examState.currentCycle = shuffle(pending);
  examState.cycleIndex = 0;
  saveExamState();
  return { isCorrect: null, done: false, nextCycle: true, cycleNumber: examState.cycleNumber, pending: pending.length };
}

async function finishExam() {
  examState.completed = true;
  examState.elapsedSeconds = Math.floor((Date.now() - examState.startTime) / 1000);
  const percentage = examState.totalQuestions > 0 ? Math.round((examState.score / examState.totalQuestions) * 100) : 0;

  await apiPut('/api/exam-sessions/' + examState.sessionId, {
    status: 'completed',
    correct_answers: examState.score,
    score: percentage,
    completed_at: new Date().toISOString(),
  });

  clearExamState();
  if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }

  return {
    done: true,
    score: percentage,
    correct: examState.score,
    total: examState.totalQuestions,
    time: examState.elapsedSeconds,
    mode: examState.mode,
    sessionId: examState.sessionId,
  };
}

function startTimer(callback) {
  if (examTimerInterval) clearInterval(examTimerInterval);
  examTimerInterval = setInterval(() => {
    if (!examState || examState.completed) return;
    examState.elapsedSeconds = Math.floor((Date.now() - examState.startTime) / 1000);
    if (callback) callback(examState.elapsedSeconds);
  }, 1000);
}

function stopTimer() {
  if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
  return true;
}

function isMultipleCorrect(question) {
  return (question.options || []).filter(o => o.is_correct).length > 1;
}
