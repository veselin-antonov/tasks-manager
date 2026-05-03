# Recurring Task Tracker

This app tracks recurring tasks and stores them in a local SQLite database.
You add tasks using a single TopCoding problem URL; the task name is derived
from the slug automatically.

## Stack

- React + Vite + TypeScript
- Tailwind CSS v4 + shadcn/ui components
- Node.js + Express API
- SQLite via `node:sqlite`

## Storage

- SQLite file: `data/tasks.sqlite`
- Table: `tasks`
  - `id` (TEXT, primary key)
  - `name` (TEXT)
  - `link` (TEXT)
  - `last_failed` (TEXT ISO datetime, nullable)

The table is created automatically on server startup.

## API Endpoints

- `GET /api/tasks` → list tasks
- `POST /api/tasks` body `{ name, link }` → add task
- `POST /api/tasks/:id/fail` → set `last_failed` to now
- `PATCH /api/tasks/:id/last-failed` body `{ lastFailed }` → edit date
- `DELETE /api/tasks/:id` → solve/remove task

## Task URL parsing

For URLs like:

- `https://app.topcoding.bg/problems/94/binary-tree-inorder-traversal/easy`

the app derives:

- `Binary Tree Inorder Traversal`

## Local Development

Create `.env.local`:

```env
VITE_API_URL=http://localhost:3001
```

Then run:

```bash
npm install
npm run dev
```

`npm run dev` starts:

1. API server on port `3001`
2. Vite frontend dev server

If `.env.local` changes, restart dev.

## Docker Compose (homelab)

This repo includes:

- `Dockerfile.api`
- `Dockerfile.web`
- `nginx.conf`
- `docker-compose.yml`

Start it:

```bash
docker compose up -d --build
```

App URL:

- `http://<your-homelab-host>:8080`
- Only the **web** container is exposed externally.
- The **api** container is internal-only and reachable from web via Docker
  network (`/api/*` proxied by nginx).

SQLite persistence:

- Host path `./data` is mounted to `/app/data` in the API container.
- Your DB survives container recreation.

Stop:

```bash
docker compose down
```
