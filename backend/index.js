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
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'simu-admin-2026';

// Neon connection string from env or direct
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cDGFftZ4yAo5@ep-polished-recipe-ahvqwihl.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serve uploaded images
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

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName, role, secret } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    let userRole = 'user';
    if (role === 'admin') {
      if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Código secreto incorrecto' });
      userRole = 'admin';
    }

    const existCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Esta cuenta ya existe. Inicia sesión.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await pool.query(
      'INSERT INTO users (id, email, password, display_name, role) VALUES ($1, $2, $3, $4, $5)',
      [id, email, hashedPassword, displayName || email, userRole]
    );

    await pool.query(
      'INSERT INTO profiles (id, role, display_name) VALUES ($1, $2, $3)',
      [id, userRole, displayName || email]
    );

    const token = jwt.sign({ id, email, role: userRole, displayName }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id, email, role: userRole, display_name: displayName || email } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error al registrar: ' + err.message });
  }
});

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
// CATEGORIES
// ==========================================

app.get('/api/categories', authenticate, async (req, res) => {
  const result = await pool.query(`
    SELECT c.*, COUNT(DISTINCT t.id)::int as topic_count
    FROM categories c
    LEFT JOIN topics t ON t.category_id = c.id
    GROUP BY c.id
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
// TOPICS
// ==========================================

app.get('/api/topics', authenticate, async (req, res) => {
  const { category_id } = req.query;
  let q = 'SELECT t.*, (SELECT COUNT(*) FROM questions q WHERE q.topic_id = t.id)::int as question_count FROM topics t';
  const params = [];
  if (category_id) {
    q += ' WHERE t.category_id = $1';
    params.push(category_id);
  }
  q += ' ORDER BY t.name';
  const result = await pool.query(q, params);
  res.json(result.rows);
});

app.post('/api/topics', authenticate, requireAdmin, async (req, res) => {
  const { name, category_id } = req.body;
  if (!name || !category_id) return res.status(400).json({ error: 'Nombre y categoría requeridos' });
  const result = await pool.query(
    'INSERT INTO topics (name, category_id) VALUES ($1, $2) RETURNING *',
    [name, category_id]
  );
  res.json(result.rows[0]);
});

app.put('/api/topics/:id', authenticate, requireAdmin, async (req, res) => {
  const { name } = req.body;
  const result = await pool.query('UPDATE topics SET name = $1 WHERE id = $2 RETURNING *', [name, req.params.id]);
  res.json(result.rows[0]);
});

app.delete('/api/topics/:id', authenticate, requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM topics WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ==========================================
// QUESTIONS
// ==========================================

app.get('/api/questions', authenticate, async (req, res) => {
  const { category_id, topic_id } = req.query;
  let q = 'SELECT q.*, t.name as topic_name FROM questions q LEFT JOIN topics t ON t.id = q.topic_id';
  const params = [];
  const conds = [];
  if (category_id) { params.push(category_id); conds.push(`q.category_id = $${params.length}`); }
  if (topic_id) { params.push(topic_id); conds.push(`q.topic_id = $${params.length}`); }
  if (conds.length) q += ' WHERE ' + conds.join(' AND ');
  q += ' ORDER BY q.created_at DESC';

  const questions = await pool.query(q, params);

  // Fetch answers for each question
  for (const question of questions.rows) {
    const answers = await pool.query('SELECT * FROM answers WHERE question_id = $1 ORDER BY created_at', [question.id]);
    question.answers = answers.rows;
  }

  res.json(questions.rows);
});

app.post('/api/questions', authenticate, requireAdmin, async (req, res) => {
  const { category_id, topic_id, text, image_url, explanation } = req.body;
  if (!text || !category_id) return res.status(400).json({ error: 'Texto y categoría requeridos' });
  const result = await pool.query(
    'INSERT INTO questions (category_id, topic_id, text, image_url, explanation) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [category_id, topic_id || null, text, image_url || null, explanation || null]
  );
  res.json(result.rows[0]);
});

app.put('/api/questions/:id', authenticate, requireAdmin, async (req, res) => {
  const { topic_id, text, image_url, explanation } = req.body;
  const result = await pool.query(
    'UPDATE questions SET topic_id = $1, text = $2, image_url = $3, explanation = $4 WHERE id = $5 RETURNING *',
    [topic_id || null, text, image_url || null, explanation || null, req.params.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/questions/:id', authenticate, requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM questions WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ==========================================
// ANSWERS
// ==========================================

app.post('/api/answers', authenticate, requireAdmin, async (req, res) => {
  const { question_id, text, is_correct } = req.body;
  if (!question_id || !text) return res.status(400).json({ error: 'Datos incompletos' });
  const result = await pool.query(
    'INSERT INTO answers (question_id, text, is_correct) VALUES ($1, $2, $3) RETURNING *',
    [question_id, text, is_correct || false]
  );
  res.json(result.rows[0]);
});

app.put('/api/answers/:id', authenticate, requireAdmin, async (req, res) => {
  const { text, is_correct } = req.body;
  const result = await pool.query(
    'UPDATE answers SET text = $1, is_correct = $2 WHERE id = $3 RETURNING *',
    [text, is_correct || false, req.params.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/answers/:id', authenticate, requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM answers WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// Batch save answers (for question save with all answers)
app.put('/api/questions/:id/answers', authenticate, requireAdmin, async (req, res) => {
  const { answers } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Delete existing
    await client.query('DELETE FROM answers WHERE question_id = $1', [req.params.id]);

    for (const a of answers) {
      if (!a.text) continue;
      await client.query(
        'INSERT INTO answers (question_id, text, is_correct) VALUES ($1, $2, $3)',
        [req.params.id, a.text, a.is_correct || false]
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
// UPLOAD (images)
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
// EXAMS
// ==========================================

app.post('/api/exams', authenticate, async (req, res) => {
  const { category_id } = req.body;
  const result = await pool.query(
    'INSERT INTO exams (user_id, category_id, status, total_questions) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.user.id, category_id, 'in_progress', 0]
  );
  res.json(result.rows[0]);
});

app.put('/api/exams/:id', authenticate, async (req, res) => {
  const { status, correct_answers, score, completed_at } = req.body;
  const result = await pool.query(
    'UPDATE exams SET status = COALESCE($1, status), correct_answers = COALESCE($2, correct_answers), score = COALESCE($3, score), completed_at = COALESCE($4, completed_at) WHERE id = $5 AND user_id = $6 RETURNING *',
    [status, correct_answers, score, completed_at, req.params.id, req.user.id]
  );
  res.json(result.rows[0]);
});

app.get('/api/exams', authenticate, async (req, res) => {
  const result = await pool.query(`
    SELECT e.*, c.name as category_name
    FROM exams e
    LEFT JOIN categories c ON c.id = e.category_id
    WHERE e.user_id = $1
    ORDER BY e.created_at DESC
    LIMIT 20
  `, [req.user.id]);
  res.json(result.rows);
});

app.get('/api/exams/last', authenticate, async (req, res) => {
  const result = await pool.query(`
    SELECT e.*, c.name as category_name
    FROM exams e
    LEFT JOIN categories c ON c.id = e.category_id
    WHERE e.user_id = $1 AND e.status = 'completed'
    ORDER BY e.completed_at DESC
    LIMIT 1
  `, [req.user.id]);
  res.json(result.rows[0] || null);
});

// ==========================================
// EXAM ANSWERS
// ==========================================

app.post('/api/exam-answers', authenticate, async (req, res) => {
  const { exam_id, question_id, selected_answer_ids, is_correct, cycle_number } = req.body;
  const result = await pool.query(
    'INSERT INTO exam_answers (exam_id, question_id, selected_answer_ids, is_correct, cycle_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [exam_id, question_id, JSON.stringify(selected_answer_ids), is_correct, cycle_number || 1]
  );
  res.json(result.rows[0]);
});

// ==========================================
// DASHBOARD DATA
// ==========================================

app.get('/api/dashboard/categories', authenticate, async (req, res) => {
  const cats = await pool.query(`
    SELECT c.*, COUNT(DISTINCT t.id)::int as topic_count,
      (SELECT COUNT(*) FROM questions q WHERE q.category_id = c.id)::int as question_count
    FROM categories c
    LEFT JOIN topics t ON t.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `);
  res.json(cats.rows);
});

app.get('/api/dashboard/history', authenticate, async (req, res) => {
  const result = await pool.query(`
    SELECT e.*, c.name as category_name
    FROM exams e
    LEFT JOIN categories c ON c.id = e.category_id
    WHERE e.user_id = $1 AND e.status = 'completed'
    ORDER BY e.completed_at DESC
    LIMIT 10
  `, [req.user.id]);
  res.json(result.rows);
});

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
// INIT DB (creates tables if not exist)
// ==========================================

async function initDB() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'dbSetup.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Database tables ready');
  } catch (err) {
    console.error('⚠️ DB init had some issues (tables may already exist):', err.message);
  }
}

// ==========================================
// START
// ==========================================

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 SimuExam API running on port ${PORT}`);
  });
});
