# task-notes UX v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, no subagents; the user ruled subagents out). Steps use checkbox (`- [ ]`) syntax for tracking. Dev style: ponytail (smallest complete change, no extras).

**Goal:** Quick-add with progressive disclosure, a filter bar with a "no repo" option, due-date urgency badges, ordered list, and full per-row edit, in the existing `task-notes` panel.

**Architecture:** Pure logic stays in `src/tasks.ts` (unit tested). `src/panel.tsx` only wires atoms to logic and renders. No worker, manifest capability or storage-shape change.

**Tech Stack:** unchanged: Orca plugin API, TSX panel, `orca plugin test|validate|check`.

**Spec:** `docs/superpowers/specs/2026-11-10-task-notes-ux-v2-design.md` (design from ui-ux-pro-max). Data and repo default: `docs/superpowers/specs/2026-11-10-task-notes-design.md`. Prior plan: `docs/superpowers/plans/2026-11-10-task-fields-filter.md`.

## Orchestration (single session, no subagent, no Orca worker)

| Phase | Owner | Output | Gate |
|---|---|---|---|
| 0 Design | ui-ux-pro-max | UX v2 spec | done |
| 1 Plan | superpowers:writing-plans | this file | user confirms the plan |
| 2 Dev | superpowers:executing-plans, ponytail | Tasks 1 to 3, one commit per task, ledger line per task | `orca plugin test .` green at each `task-done` |
| 3 Review | self-review of the whole branch, written to the ledger as `Final review: self-review (no subagent tool)` | findings graded, Critical/Important fixed RED to GREEN | suite green, `validate` and `check` pass |

Branch: `feat/task-fields-filter` is unmerged; this work continues on a new branch `feat/ux-v2` cut from it.

## Global Constraints

- Statuses exactly `todo`, `in-progress`, `in-review`, `completed`. Task shape unchanged: `{ id, title, description, dueDate, status, repo, worktree, at }`.
- Only Orca components (`orca` imports); no custom colors or fonts. Badge tone only `neutral` or `warning` unless Step 1 of Task 1 finds `danger` in `.orca/types/orca/index.d.ts` and the spec's open point is resolved in the ledger.
- Copy is Thai, exactly as the spec: `งานใหม่`, `เพิ่ม`, `รายละเอียดเพิ่มเติม`, `รายละเอียด`, `วันครบกำหนด`, `กรองสถานะ`, `กรองตามที่เก็บ`, `ไม่ระบุ repo`, `ทุก repo`, `ทั้งหมด`, `เลยกำหนด N วัน`, `ครบวันนี้`, `ครบอีก N วัน`, `บันทึก`, `ยกเลิก`, `พิมพ์ข้อความงานก่อน`, `วันที่ต้องเป็น YYYY-MM-DD`, `ไม่มีงานตรงตัวกรอง`.
- Urgency never by color alone: always the text in the table in the spec.
- Text fields render as plain text. `render` never writes storage; only user actions do.
- "Today" is the local calendar day.
- Run tests with `orca plugin test .` (it runs every test file; it cannot filter). `orca.exe` is in `%LOCALAPPDATA%\Programs\orca\resources\bin\` if not on PATH.
- The agent never runs `orca plugin install --approve`; the user does.

## Review Focus

- Due-date arithmetic across month end, year end and a leap day (2028-02-29): pinned in Task 1 tests.
- Sort with equal due dates, no due date, and completed tasks: pinned in Task 1 tests.
- Saving an edit with a blank title or an invalid due date leaves storage untouched: Task 1 (`updateTask`) and Task 3 (panel) tests.
- The "ไม่ระบุ repo" filter value must survive the stale-filter fallback in `panel.tsx` (which resets any value not in the repo options): Task 2 test.
- A row in edit mode that a filter or tab change hides, then shows again: no error, still editable: Task 3 test.

---

### Task 1: Logic in `src/tasks.ts`

**Files:**
- Modify: `src/tasks.ts`, `src/tasks.test.ts`

**Interfaces:**
- Produces:
  - `export const NO_REPO: string` (`'\u0000no-repo'`, cannot be a folder name)
  - `filterTasks(tasks, f: { status: Status | ''; repo: string })`: now `f.repo === NO_REPO` keeps only tasks with `repo === ''`
  - `todayLocal(now?: Date): string` (`YYYY-MM-DD`, local)
  - `daysUntil(due: string, today: string): number` (due minus today, whole days)
  - `dueBadge(t: Pick<Task, 'dueDate' | 'status'>, today: string): { text: string; tone: 'neutral' | 'warning' } | null` (null when no due date; table in spec; `completed` shows the plain date, neutral)
  - `sortTasks(tasks: Task[]): Task[]` (new array; unfinished first, then `dueDate` ascending with empty last, then `at` ascending, then input order)
  - `updateTask(tasks, id, patch: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'repo' | 'status'>>): Task[]` (title trimmed; returns `tasks` unchanged if the patched title is blank or the patched `dueDate` fails `validDue`)

- [ ] **Step 1: Read `.orca/types/orca/index.d.ts` for `BadgeProps`**; ledger `Ruling:` with the tones it offers (decides the open point in the spec).
- [ ] **Step 2: Write failing tests in `src/tasks.test.ts`:**
  - `daysUntil`: `('2026-03-01','2026-02-28') = 1`, `('2028-03-01','2028-02-28') = 2`, `('2027-01-01','2026-12-31') = 1`, `('2026-05-01','2026-05-02') = -1`.
  - `dueBadge`: overdue 3 days `{text:'เลยกำหนด 3 วัน', tone:'warning'}`; today `ครบวันนี้` warning; 1 and 2 days `ครบอีก 1 วัน` / `ครบอีก 2 วัน` neutral; 3 days away is the date, neutral; `completed` with an overdue date is the date, neutral; empty due is `null`.
  - `todayLocal(new Date(2026, 0, 5))` is `'2026-01-05'`.
  - `sortTasks`: order `[done-early, none, due-late, due-early]` becomes `[due-early, due-late, none, done-early]`; equal due and equal `at` keep input order; input array not mutated.
  - `filterTasks` with `repo: NO_REPO` keeps only `repo === ''` tasks and combines with status.
  - `updateTask`: changes only the matching id; trims title; blank title returns the same array; `dueDate: '2026-02-30'` returns the same array; `dueDate: ''` clears it.
- [ ] **Step 3: Run `orca plugin test .`**. Expected: the new tests fail (missing exports), existing tests pass.
- [ ] **Step 4: Implement the signatures above in `src/tasks.ts`.** `daysUntil` parses both dates as UTC midnight (`Date.UTC`) and divides by 86400000.
- [ ] **Step 5: Run `orca plugin test .`**. Expected: all pass.
- [ ] **Step 6: Commit** `feat: due badge, sort, update and no-repo filter in task logic`.

### Task 2: Quick add, filter bar, rows, order in `src/panel.tsx`

**Files:**
- Modify: `src/panel.tsx`, `src/panel.test.tsx`, `src/panel.check.ts`

**Interfaces:**
- Consumes: Task 1 (`NO_REPO`, `todayLocal`, `dueBadge`, `sortTasks`, `filterTasks`).
- Produces (keys, which tests address as `testId`): `more-toggle` (the `รายละเอียดเพิ่มเติม` Button), existing `filter-status`, `filter-repo`, `done-<id>`, `status-<id>`, `delete-<id>`, `edit-<id>`.

- [ ] **Step 1: Update `src/panel.test.tsx` and add failing tests:**
  - Existing tests that touch the Textarea, due Input, form repo Select/Input or form status Select first `await view.press({ testId: 'more-toggle' })`.
  - New: Textarea `รายละเอียด` and Input `วันครบกำหนด` are absent until `more-toggle` is pressed; `find(...)` is `null` before, present after.
  - New: quick add with only a title stores `description ''`, `dueDate ''`, status `todo`, default repo.
  - New: invalid due date on Add opens the section and shows `วันที่ต้องเป็น YYYY-MM-DD`, with the section closed beforehand.
  - New: a task due `2000-01-01` shows badge text starting `เลยกำหนด`; a task due `todayLocal()` shows `ครบวันนี้`; a `completed` task due `2000-01-01` shows `2000-01-01`.
  - New: the repo filter lists `ไม่ระบุ repo`; choosing `NO_REPO` shows only tasks with `repo ''`; after choosing it and then editing nothing, the list is still filtered (stale-filter fallback must keep `NO_REPO`).
  - New: rows are ordered by `sortTasks` (a later-due task added first renders after an earlier-due one).
- [ ] **Step 2: Run `orca plugin test .`**. Expected: new tests fail, others pass.
- [ ] **Step 3: Implement in `src/panel.tsx`:** `more` atom (bool) toggled by the Button and set true by an invalid-due submit; extra fields render only when `more`; repo filter options gain `{ value: NO_REPO, label: 'ไม่ระบุ repo' }` after `ทุก repo`; stale fallback accepts `'all'`, `NO_REPO` or a value in `options`; visible list is `sortTasks(filterTasks(...))`; row due badge from `dueBadge(t, todayLocal())`; delete the local `today()` helper.
- [ ] **Step 4: Update `src/panel.check.ts`** so a scenario has an overdue task and a no-repo task.
- [ ] **Step 5: Run `orca plugin test .`, `orca plugin validate .`, `orca plugin check .`**. Expected: all pass.
- [ ] **Step 6: Commit** `feat: quick add, no-repo filter, due badges and order in panel`.

### Task 3: Row edit mode and docs

**Files:**
- Modify: `src/panel.tsx`, `src/panel.test.tsx`, `README.md`, `orca-plugin.json` (version `0.2.0`)

**Interfaces:**
- Consumes: `updateTask` (Task 1). Replaces the repo-only edit (`editing` atom, `repo-<id>` key).
- Produces (keys): `edit-title-<id>`, `edit-desc-<id>`, `edit-due-<id>`, `edit-repo-<id>`, `edit-status-<id>`, `save-<id>`, `cancel-<id>`.

- [ ] **Step 1: Failing tests in `src/panel.test.tsx`:**
  - Pressing `edit-<id>` replaces that row with the edit fields, pre-filled; other rows stay read mode (one edit at a time: pressing `edit-<other>` moves edit mode).
  - Saving changes title, description, due, repo and status of that task only and leaves the new-task default repo alone.
  - Blank title on save shows `พิมพ์ข้อความงานก่อน`, row stays open, storage unchanged.
  - Invalid due on save shows `วันที่ต้องเป็น YYYY-MM-DD`, row stays open, storage unchanged.
  - `cancel-<id>` restores read mode and writes nothing.
  - With no known repo, `edit-repo-<id>` is a typed Input and saves its text.
  - Edit mode, then a status filter that hides the task, then back to `ทั้งหมด`: no errors and the row is still in edit mode.
  - Replace the old tests `changing a row's repo…` and `with no known repo a row's repo is typed…` with the ones above.
- [ ] **Step 2: Run `orca plugin test .`**. Expected: new tests fail.
- [ ] **Step 3: Implement edit mode in `src/panel.tsx`:** edit draft held per field in atoms set when `edit-<id>` is pressed; `บันทึก` and Enter in the title Input first check the draft (blank title, `!validDue(due)`) and show the matching `Field error` without closing; otherwise call `edit((l) => updateTask(l, id, draft))` and close. Remove the old repo-only edit code and `setRepo` if nothing else uses it.
- [ ] **Step 4: README**: update the first paragraph and add a short "Using the panel" list matching the spec; keep the AI access section. Bump `orca-plugin.json` version to `0.2.0`.
- [ ] **Step 5: Run `orca plugin test .`, `orca plugin validate .`, `orca plugin check .`**. Expected: all pass.
- [ ] **Step 6: Commit** `feat: edit a task in place; docs`.
