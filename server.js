import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';

const PORT = Number.parseInt(process.env.PORT ?? '3001', 10);
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, 'data');
const dbFile = resolve(dataDir, 'tasks.sqlite');

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbFile);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    link TEXT NOT NULL,
    last_failed TEXT NULL
  );
`);

const app = express();

if (process.env.NODE_ENV !== 'production') {
  app.use(
    cors({
      origin: [/^http:\/\/localhost:\d+$/],
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    }),
  );
}

app.use(express.json());

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function mapTask(row) {
  return {
    id: row.id,
    name: row.name,
    link: row.link,
    lastFailed: row.last_failed,
  };
}

function parseLastFailed(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const raw = String(value).trim();

  if (!raw) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)).toISOString();
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function readTaskById(id) {
  return db
    .prepare('SELECT id, name, link, last_failed FROM tasks WHERE id = ? LIMIT 1')
    .get(id);
}

app.get('/api/tasks', (_req, res) => {
  const stmt = db.prepare(`
    SELECT id, name, link, last_failed
    FROM tasks
    ORDER BY (last_failed IS NULL), last_failed ASC
  `);

  const rows = stmt.all().map(mapTask);
  res.json({ tasks: rows });
});

app.post('/api/tasks', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const link = String(req.body?.link ?? '').trim();

  if (!name) {
    res.status(400).json({ error: 'name_required' });
    return;
  }

  if (!link) {
    res.status(400).json({ error: 'link_required' });
    return;
  }

  if (!isValidUrl(link)) {
    res.status(400).json({ error: 'invalid_link' });
    return;
  }

  const task = {
    id: randomUUID(),
    name,
    link,
    lastFailed: new Date().toISOString(),
  };

  const stmt = db.prepare(
    'INSERT INTO tasks (id, name, link, last_failed) VALUES (?, ?, ?, ?)',
  );

  stmt.run(task.id, task.name, task.link, task.lastFailed);
  res.status(201).json({ task });
});

app.post('/api/tasks/:id/fail', (req, res) => {
  const id = String(req.params.id ?? '').trim();

  if (!id) {
    res.status(400).json({ error: 'id_required' });
    return;
  }

  const nextDate = new Date().toISOString();
  const update = db.prepare('UPDATE tasks SET last_failed = ? WHERE id = ?');
  const result = update.run(nextDate, id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'task_not_found' });
    return;
  }

  const row = readTaskById(id);
  res.json({ task: mapTask(row) });
});

app.patch('/api/tasks/:id/last-failed', (req, res) => {
  const id = String(req.params.id ?? '').trim();

  if (!id) {
    res.status(400).json({ error: 'id_required' });
    return;
  }

  const normalized = parseLastFailed(req.body?.lastFailed);

  if (req.body?.lastFailed && normalized === null) {
    res.status(400).json({ error: 'invalid_last_failed' });
    return;
  }

  const result = db
    .prepare('UPDATE tasks SET last_failed = ? WHERE id = ?')
    .run(normalized, id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'task_not_found' });
    return;
  }

  const row = readTaskById(id);
  res.json({ task: mapTask(row) });
});

app.delete('/api/tasks/:id', (req, res) => {
  const id = String(req.params.id ?? '').trim();

  if (!id) {
    res.status(400).json({ error: 'id_required' });
    return;
  }

  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'task_not_found' });
    return;
  }

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
