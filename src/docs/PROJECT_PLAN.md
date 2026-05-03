# Build a Task Tracker Web App

Build a React web app for tracking recurring tasks that periodically "fail" and need attention. Data must be stored in a Google Sheet so I can access it from multiple devices.

## Business Requirements

### Core Concept

I have a list of tasks that each have a link (e.g., to a ticket, document, or tool). Each task has a "last failed" date. Tasks I haven't touched in 4+ days are considered **due** and need attention. This app helps me track them.

### Features

1. **View tasks** in a sorted list
   - Sort by `lastFailed` date ascending (oldest first / most urgent at top)
   - Tasks with no date should appear at the bottom
   - Each task displays: name (as a clickable link), last failed date, days since last failure
   - Each row has two action buttons: **Fail** and **Solve**

2. **Add a task**
   - Input fields for task name and link (URL)
   - Both required
   - On submit, a new task is added with today's date as `lastFailed`
   - Clear the inputs after successful add

3. **Fail a task**
   - Clicking "Fail" resets that task's `lastFailed` to today
   - List re-sorts automatically

4. **Solve a task**
   - Clicking "Solve" permanently removes the task from the list
   - Should have no confirmation dialog (keep it fast)

5. **Visual indicators**
   - Tasks that are 4+ days old: **yellow** background
   - Tasks less than 4 days old: **grey/muted** background
   - Tasks with no date: neutral styling

6. **Summary stats** displayed prominently at the top
   - **Due**: count of tasks 4+ days old
   - **Pending**: count of all tasks that are NOT due (includes never-failed and recently-failed)
   - **Total**: total count

7. **Loading / error states**
   - Show toast notifications for errors
   - Disable buttons during in-flight requests
   - Show a sensible empty state when there are no tasks

## Tech Stack (strict)

- **Vite + React + TypeScript**
- **Tailwind CSS v4** (uses `@tailwindcss/vite` plugin, no `tailwind.config.js`, CSS is just `@import "tailwindcss";`)
- **shadcn/ui** components for UI (Radix primitives, Nova preset)
- **Google Apps Script Web App** as backend (no separate server)
- **Google Sheets** as the database
- Path alias `@/*` → `./src/*`

Required shadcn components to install: `button`, `input`, `card`, `table`, `sonner`

## Backend: Google Apps Script

Create an Apps Script bound to a Google Sheet with a tab named `Tasks` and headers in row 1:

- A: `id` (UUID string)
- B: `name`
- C: `link`
- D: `lastFailed` (date)

The Apps Script must expose a JSON API via `doGet` and `doPost` with these actions (passed via query param `action`):

- `list` → returns `{ tasks: Task[] }`
- `add` (params: `name`, `link`) → returns `{ task: Task }`, appends row with new UUID and today's date
- `fail` (params: `id`) → returns `{ task: Task }`, sets `lastFailed` to today
- `solve` (params: `id`) → returns `{ ok: true }`, deletes the row

Where `Task = { id: string; name: string; link: string; lastFailed: string | null }` and `lastFailed` is ISO-formatted.

**Authentication**: every request must include a `token` query param that matches a hardcoded constant `SECRET` in the script. Reject mismatches with HTTP-style `{ error: 'unauthorized' }` JSON. Deployment is "Anyone" access but protected by this shared secret.

Include error handling that returns `{ error: string }` on exceptions.

## Frontend Structure

```
src/
  lib/
    api.ts       # API client using fetch + URLSearchParams
    tasks.ts     # sortTasks, isDue, daysSince helpers
  components/    # shadcn components go here
  App.tsx        # main UI
  main.tsx       # includes <Toaster />
  index.css      # @import "tailwindcss";
```

### API client (`src/lib/api.ts`)

- Reads `VITE_API_URL` and `VITE_API_TOKEN` from env
- Exports `api.list()`, `api.add(name, link)`, `api.fail(id)`, `api.solve(id)`
- Throws on `data.error`

### Helpers (`src/lib/tasks.ts`)

- `daysSince(iso)`: integer days between an ISO date and today, or `null` if input is null
- `isDue(task)`: true if `daysSince(task.lastFailed) >= 4`
- `sortTasks(tasks)`: ascending by `lastFailed`, nulls at the bottom

### UI (`App.tsx`)

- Centered layout, max width ~4xl, responsive
- Top: three stat cards (Due, Pending, Total)
- Middle: "Add task" card with two inputs + Add button in a row
- Bottom: shadcn `Table` listing all tasks, styled per rules above
- Links open in a new tab
- Date cell shows both formatted date and "(Nd)" for days since

## Environment

Create a `.env.local` with:

```
VITE_API_URL=<apps script web app URL>
VITE_API_TOKEN=<same as SECRET in apps script>
```

Note that `VITE_` vars are public — document this clearly in the README.

## Deliverables

1. Complete Vite + React + TS project with all dependencies installed
2. All source files as described
3. The Apps Script code in a file called `apps-script.js` at the project root for me to paste into Google Apps Script
4. A `README.md` that covers:
   - Google Sheet setup (sheet name, columns)
   - Apps Script deployment steps (New deployment → Web app → Execute as me → Anyone → copy URL)
   - How to generate a good `SECRET` (`openssl rand -hex 32`)
   - Setting env vars locally and on Vercel/Netlify
   - Security warning about `VITE_` vars being public and this being personal-use only
   - `npm run dev` to start

## Code Quality

- Strict TypeScript, no `any`
- Prettier-formatted with 80 char line width
- Sensible component splitting if `App.tsx` gets long
- Keep it simple — no state management libraries, no react-query, just `useState` + `useEffect`
- Prefer functional, readable code over clever abstractions

## Out of Scope (do not build)

- Authentication beyond the shared token
- Editing existing tasks
- Optimistic updates
- Offline support
- Dark mode toggle (but use shadcn's built-in dark-mode-aware classes)
- Tests

Build this end-to-end and make sure `npm run dev` works out of the box after I fill in `.env.local`.
