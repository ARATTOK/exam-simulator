const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'simuexam-jwt-secret-2026';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cDGFftZ4yAo5@ep-polished-recipe-ahvqwihl.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth middleware
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Se requieren permisos de administrador' });
  }
  next();
}

// ==========================================
// AUTH
// ==========================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, display_name: user.display_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, display_name: user.display_name }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, role, display_name FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CATEGORIES (shared)
// ==========================================

app.get('/api/categories', authenticate, async (req, res) => {
  const result = await pool.query(`
    SELECT c.*, (SELECT COUNT(*) FROM exam_definitions ed WHERE ed.category_id = c.id)::int as exam_count
    FROM categories c
    ORDER BY c.name
  `);
  res.json(result.rows);
});

app.post('/api/categories', authenticate, requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const result = await pool.query(
    'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
    [name, description || '']
  );
  res.json(result.rows[0]);
});

app.put('/api/categories/:id', authenticate, requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  const result = await pool.query(
    'UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
    [name, description || '', req.params.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/categories/:id', authenticate, requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ==========================================
// EXAM DEFINITIONS
// ==========================================

app.get('/api/exam-definitions', authenticate, async (req, res) => {
  const result = await pool.query(`
    SELECT ed.*, c.name as category_name,
      (SELECT COUNT(*) FROM exam_topics et WHERE et.exam_definition_id = ed.id)::int as topic_count,
      (SELECT COUNT(*) FROM exam_questions eq
        JOIN exam_topics et2 ON et2.id = eq.exam_topic_id
        WHERE et2.exam_definition_id = ed.id)::int as question_count
    FROM exam_definitions ed
    LEFT JOIN categories c ON c.id = ed.category_id
    ORDER BY ed.name
  `);
  res.json(result.rows);
});

app.post('/api/exam-definitions', authenticate, requireAdmin, async (req, res) => {
  const { name, description, category_id, passing_score, suggested_minutes, official_url } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const result = await pool.query(
    `INSERT INTO exam_definitions (name, description, category_id, passing_score, suggested_minutes, official_url)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, description || '', category_id || null, passing_score || 70, suggested_minutes || 0, official_url || null]
  );
  res.json(result.rows[0]);
});

app.put('/api/exam-definitions/:id', authenticate, requireAdmin, async (req, res) => {
  const { name, description, category_id, passing_score, suggested_minutes, official_url } = req.body;
  const result = await pool.query(
    `UPDATE exam_definitions SET name = $1, description = $2, category_id = $3,
     passing_score = $4, suggested_minutes = $5, official_url = $6, updated_at = now()
     WHERE id = $7 RETURNING *`,
    [name, description || '', category_id || null, passing_score || 70, suggested_minutes || 0, official_url || null, req.params.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/exam-definitions/:id', authenticate, requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM exam_definitions WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ==========================================
// EXAM TOPICS
// ==========================================

app.get('/api/exam-definitions/:id/topics', authenticate, async (req, res) => {
  const result = await pool.query(`
    SELECT et.*,
      (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_topic_id = et.id)::int as question_count
    FROM exam_topics et
    WHERE et.exam_definition_id = $1
    ORDER BY et.name
  `, [req.params.id]);
  res.json(result.rows);
});

app.post('/api/exam-topics', authenticate, requireAdmin, async (req, res) => {
  const { name, exam_definition_id } = req.body;
  if (!name || !exam_definition_id) return res.status(400).json({ error: 'Nombre y examen requeridos' });
  const result = await pool.query(
    'INSERT INTO exam_topics (name, exam_definition_id) VALUES ($1, $2) RETURNING *',
    [name, exam_definition_id]
  );
  res.json(result.rows[0]);
});

app.put('/api/exam-topics/:id', authenticate, requireAdmin, async (req, res) => {
  const { name } = req.body;
  const result = await pool.query(
    'UPDATE exam_topics SET name = $1 WHERE id = $2 RETURNING *',
    [name, req.params.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/exam-topics/:id', authenticate, requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM exam_topics WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ==========================================
// EXAM QUESTIONS
// ==========================================

app.get('/api/exam-topics/:id/questions', authenticate, async (req, res) => {
  const questions = await pool.query(
    'SELECT * FROM exam_questions WHERE exam_topic_id = $1 ORDER BY created_at',
    [req.params.id]
  );
  for (const q of questions.rows) {
    const opts = await pool.query(
      'SELECT * FROM exam_question_options WHERE exam_question_id = $1 ORDER BY created_at',
      [q.id]
    );
    q.options = opts.rows;
  }
  res.json(questions.rows);
});

app.post('/api/exam-questions', authenticate, requireAdmin, async (req, res) => {
  const { exam_topic_id, text, image_url, explanation } = req.body;
  if (!text || !exam_topic_id) return res.status(400).json({ error: 'Texto y tema requeridos' });
  const result = await pool.query(
    'INSERT INTO exam_questions (exam_topic_id, text, image_url, explanation) VALUES ($1, $2, $3, $4) RETURNING *',
    [exam_topic_id, text, image_url || null, explanation || null]
  );
  res.json(result.rows[0]);
});

app.put('/api/exam-questions/:id', authenticate, requireAdmin, async (req, res) => {
  const { text, image_url, explanation } = req.body;
  const result = await pool.query(
    'UPDATE exam_questions SET text = $1, image_url = $2, explanation = $3 WHERE id = $4 RETURNING *',
    [text, image_url || null, explanation || null, req.params.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/exam-questions/:id', authenticate, requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM exam_questions WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// Batch save options for a question
app.put('/api/exam-questions/:id/options', authenticate, requireAdmin, async (req, res) => {
  const { options } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM exam_question_options WHERE exam_question_id = $1', [req.params.id]);
    for (const o of options) {
      if (!o.text) continue;
      await client.query(
        'INSERT INTO exam_question_options (exam_question_id, text, is_correct) VALUES ($1, $2, $3)',
        [req.params.id, o.text, o.is_correct || false]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// IMPORT questions into an exam definition
// ==========================================

app.post('/api/exam-definitions/:id/import', authenticate, requireAdmin, async (req, res) => {
  const { items } = req.body;
  const examDefId = req.params.id;
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Se requiere un array de preguntas' });

  let imported = 0;
  for (const item of items) {
    const topicName = item.topic || item.tema;
    if (!topicName) continue;

    let topic = await pool.query(
      'SELECT id FROM exam_topics WHERE exam_definition_id = $1 AND LOWER(name) = LOWER($2)',
      [examDefId, topicName]
    );
    let topicId;
    if (topic.rows.length === 0) {
      const newTopic = await pool.query(
        'INSERT INTO exam_topics (name, exam_definition_id) VALUES ($1, $2) RETURNING id',
        [topicName, examDefId]
      );
      topicId = newTopic.rows[0].id;
    } else {
      topicId = topic.rows[0].id;
    }

    const questionText = item.question || item.pregunta || item.text;
    if (!questionText) continue;

    const explanation = item.explanation || item.explicacion || '';
    const imageUrl = item.image || item.imagen || '';

    const q = await pool.query(
      'INSERT INTO exam_questions (exam_topic_id, text, image_url, explanation) VALUES ($1, $2, $3, $4) RETURNING id',
      [topicId, questionText, imageUrl, explanation]
    );
    const questionId = q.rows[0].id;

    const options = [];
    for (let i = 1; i <= 10; i++) {
      const optText = item['answer' + i] || item['option' + i] || item['respuesta' + i] || '';
      if (!optText) continue;
      const isCorrect = item['correct' + i] === 'true' || item['correct' + i] === 'yes' ||
        item['correct' + i] === '1' || item['correct' + i] === true ||
        item['correcta' + i] === 'true';
      options.push({ text: optText, is_correct: isCorrect });
    }

    if (options.length > 0) {
      for (const o of options) {
        await pool.query(
          'INSERT INTO exam_question_options (exam_question_id, text, is_correct) VALUES ($1, $2, $3)',
          [questionId, o.text, o.is_correct]
        );
      }
    }
    imported++;
  }
  res.json({ imported });
});

// ==========================================
// EXAM SESSIONS (user attempts)
// ==========================================

app.post('/api/exam-sessions', authenticate, async (req, res) => {
  const { exam_definition_id, mode, question_count } = req.body;
  if (!exam_definition_id) return res.status(400).json({ error: 'Examen requerido' });

  const result = await pool.query(
    `INSERT INTO exam_sessions (user_id, exam_definition_id, mode, status, total_questions)
     VALUES ($1, $2, $3, 'in_progress', $4) RETURNING *`,
    [req.user.id, exam_definition_id, mode || 'practice', question_count || 0]
  );
  res.json(result.rows[0]);
});

app.put('/api/exam-sessions/:id', authenticate, async (req, res) => {
  const { status, correct_answers, score, completed_at } = req.body;
  const result = await pool.query(
    `UPDATE exam_sessions SET status = COALESCE($1, status),
     correct_answers = COALESCE($2, correct_answers),
     score = COALESCE($3, score),
     completed_at = COALESCE($4, completed_at)
     WHERE id = $5 AND user_id = $6 RETURNING *`,
    [status, correct_answers, score, completed_at, req.params.id, req.user.id]
  );
  res.json(result.rows[0]);
});

app.get('/api/exam-sessions/last', authenticate, async (req, res) => {
  const result = await pool.query(`
    SELECT es.*, ed.name as exam_name, ed.category_id, c.name as category_name
    FROM exam_sessions es
    JOIN exam_definitions ed ON ed.id = es.exam_definition_id
    LEFT JOIN categories c ON c.id = ed.category_id
    WHERE es.user_id = $1 AND es.status = 'completed'
    ORDER BY es.completed_at DESC
    LIMIT 1
  `, [req.user.id]);
  res.json(result.rows[0] || null);
});

// ==========================================
// SESSION ANSWERS
// ==========================================

app.post('/api/session-answers', authenticate, async (req, res) => {
  const { session_id, exam_question_id, selected_option_ids, is_correct, cycle_number } = req.body;
  const result = await pool.query(
    `INSERT INTO session_answers (session_id, exam_question_id, selected_option_ids, is_correct, cycle_number)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [session_id, exam_question_id, JSON.stringify(selected_option_ids), is_correct, cycle_number || 1]
  );
  res.json(result.rows[0]);
});

// ==========================================
// DASHBOARD
// ==========================================

app.get('/api/dashboard/exams', authenticate, async (req, res) => {
  const result = await pool.query(`
    SELECT ed.*, c.name as category_name,
      (SELECT COUNT(*) FROM exam_questions eq
        JOIN exam_topics et2 ON et2.id = eq.exam_topic_id
        WHERE et2.exam_definition_id = ed.id)::int as question_count,
      (SELECT COUNT(*) FROM exam_topics et WHERE et.exam_definition_id = ed.id)::int as topic_count
    FROM exam_definitions ed
    LEFT JOIN categories c ON c.id = ed.category_id
    ORDER BY ed.name
  `);
  res.json(result.rows);
});

app.get('/api/dashboard/history', authenticate, async (req, res) => {
  const result = await pool.query(`
    SELECT es.*, ed.name as exam_name, c.name as category_name
    FROM exam_sessions es
    JOIN exam_definitions ed ON ed.id = es.exam_definition_id
    LEFT JOIN categories c ON c.id = ed.category_id
    WHERE es.user_id = $1 AND es.status = 'completed'
    ORDER BY es.completed_at DESC
    LIMIT 10
  `, [req.user.id]);
  res.json(result.rows);
});

// ==========================================
// UPLOAD
// ==========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/upload', authenticate, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url });
});

// ==========================================
// MIGRATION: legacy data → new structure
// ==========================================

async function runMigration() {
  // Check if legacy tables exist and have data
  const legacyCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables WHERE table_name = 'questions'
    ) as has_questions
  `);

  if (!legacyCheck.rows[0].has_questions) return;

  const legacyCount = await pool.query('SELECT COUNT(*) FROM questions');
  if (parseInt(legacyCount.rows[0].count) === 0) return;

  console.log('🔄 Migrating legacy data to new structure...');

  // Get or create default category
  const cats = await pool.query('SELECT * FROM categories ORDER BY name LIMIT 1');
  let categoryId = cats.rows[0]?.id || null;

  // Create exam definition from first category name
  const examName = categoryId
    ? (await pool.query('SELECT name FROM categories WHERE id = $1', [categoryId])).rows[0]?.name || 'Examen importado'
    : 'Examen importado';

  const def = await pool.query(
    `INSERT INTO exam_definitions (name, description, category_id)
     VALUES ($1, $2, $3) RETURNING id`,
    [examName, 'Importado desde versión anterior', categoryId]
  );
  const examDefId = def.rows[0].id;

  // Migrate topics
  const oldTopics = await pool.query('SELECT * FROM topics');
  const topicMap = {};
  for (const t of oldTopics.rows) {
    const nt = await pool.query(
      'INSERT INTO exam_topics (name, exam_definition_id) VALUES ($1, $2) RETURNING id',
      [t.name, examDefId]
    );
    topicMap[t.id] = nt.rows[0].id;
  }

  // Migrate questions
  const oldQuestions = await pool.query('SELECT * FROM questions');
  for (const q of oldQuestions.rows) {
    const newTopicId = topicMap[q.topic_id] || null;
    if (!newTopicId) continue;

    const nq = await pool.query(
      'INSERT INTO exam_questions (exam_topic_id, text, image_url, explanation) VALUES ($1, $2, $3, $4) RETURNING id',
      [newTopicId, q.text, q.image_url, q.explanation]
    );
    const newQuestionId = nq.rows[0].id;

    const oldOptions = await pool.query('SELECT * FROM answers WHERE question_id = $1', [q.id]);
    for (const o of oldOptions.rows) {
      await pool.query(
        'INSERT INTO exam_question_options (exam_question_id, text, is_correct) VALUES ($1, $2, $3)',
        [newQuestionId, o.text, o.is_correct]
      );
    }
  }

  console.log(`✅ Migration complete: ${oldQuestions.rows.length} questions migrated`);
}

// ==========================================
// HEALTH
// ==========================================

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// ==========================================
// INIT
// ==========================================

async function initDB() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'dbSetup.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Database tables ready');
    await runMigration();
  } catch (err) {
    console.error('⚠️ DB init issue:', err.message);
  }
}

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 SimuExam API running on port ${PORT}`);
  });
});
