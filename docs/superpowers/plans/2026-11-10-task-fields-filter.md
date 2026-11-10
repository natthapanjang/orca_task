# task-notes: title / description / due date / filters / AI read Implementation Plan

> Written inline by the executor: the user gave a request, no prior plan. Spec = the request (below) + `docs/superpowers/specs/2026-11-10-task-notes-design.md`.

**Goal:** Extend the existing `task-notes` plugin: each task has `title`, `description`, `dueDate`, `repo`, `status`; the panel can filter tasks; an AI session can read the tasks of one repo.

**Request (spec):** fields title, description, duedate, repo, status; filter tasks; an AI session can read a repo's tasks.

**Tech Stack:** unchanged (Orca plugin API, TSX panel, `orca plugin test|validate|check`).

## Global Constraints

- Task shape: `{ id, title, description, dueDate, status, repo, worktree, at }`. `dueDate` is `''` or `YYYY-MM-DD` (a real calendar date). `description` may be `''`.
- Legacy stored items with `text` and no `title` load with `title = text`; nothing in storage is rewritten on render.
- Title is required (blank ignored); text fields render as plain text.
- No date component exists in the API: due date is a text Input with placeholder `YYYY-MM-DD`; an invalid value blocks Add with an error.
- Filters: status (`ทั้งหมด` + 4 statuses) and repo (`ทั้งหมด` + options); they combine with the existing tabs (AND).
- AI access: no file-write capability exists (`storage:own`, `settings:own`, `secrets:own`, `workspace:read`, `agent:read`), so the agent reads `storage.json` directly. README documents the path and a per-repo filter command. No new capability.

## Review Focus

- Legacy `text` items survive and display.
- `dueDate` like `2026-02-30` or `abc` is rejected on add and dropped to `''` on load.
- Filter by repo hides tasks whose repo is `''` unless filter is all.

---

### Task 1: Task logic (`src/tasks.ts`)

**Interfaces:** Produces `Task` with `title/description/dueDate`; `validDue(s): boolean`; `addTask(tasks, {title, description, dueDate, repo, worktree, status?}, now, newId)`; `filterTasks(tasks, {status: Status|'', repo: string})`; `parseTasks` handles legacy `text`.

- [ ] Update `src/tasks.test.ts` first (RED): fixtures use `title`; add tests for legacy `text`, `validDue`, `filterTasks`, parse of bad `dueDate`.
- [ ] Implement in `src/tasks.ts` (GREEN).
- [ ] Commit `feat: title, description, due date and filter in task logic`.
- Test command: `orca plugin test .`

### Task 2: Panel (`src/panel.tsx`)

**Interfaces:** Consumes Task 1.

- [ ] Update `src/panel.test.tsx` first (RED): `t.text` → `t.title`; new tests: description + due stored; invalid due blocks add with error; row shows description and due; status filter; repo filter.
- [ ] Implement: add form (title Input keeps label `งานใหม่`, description Textarea, due Input `วันครบกำหนด`), row shows description + due Badge (overdue = warning), filter bar above tabs (`กรองสถานะ`, `กรอง repo`).
- [ ] `orca plugin validate .` and `orca plugin check .`.
- [ ] Commit `feat: task fields and filters in panel`.
- Test command: `orca plugin test .`

### Task 3: Docs

- [ ] README: new fields, filters, "AI access" section (storage.json path + filter-by-repo command, verified against a sample file). Manifest description updated.
- [ ] Commit `docs: AI access and new fields`.
- Test command: `orca plugin validate .`
