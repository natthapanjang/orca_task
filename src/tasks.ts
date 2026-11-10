export type Status = 'todo' | 'in-progress' | 'in-review' | 'completed'
export const STATUSES: readonly Status[] = ['todo', 'in-progress', 'in-review', 'completed']

export type Worktree = { displayName: string; branch: string }
export type Task = {
  id: string
  title: string
  description: string
  /** '' or a real calendar date, YYYY-MM-DD. */
  dueDate: string
  status: Status
  repo: string
  worktree: Worktree
  at: number
}

const isStr = (v: unknown): v is string => typeof v === 'string'

/** '' (no due date) or a real YYYY-MM-DD calendar date. */
export function validDue(s: string): boolean {
  if (s === '') return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

// Only id, title (or legacy text) and status are required; bad repo/worktree/at fall back to defaults so hand-edited items survive.
export function parseTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return []
  const out: Task[] = []
  for (const it of raw) {
    if (typeof it !== 'object' || it === null) continue
    const { id, text, description, dueDate, status, repo, worktree: wt, at } = it as Record<string, any>
    // Items saved before the title field existed carry `text`.
    const title = isStr(it.title) ? it.title : text
    if (!isStr(id) || !isStr(title) || !title.trim() || !STATUSES.includes(status)) continue
    const w = typeof wt === 'object' && wt !== null ? wt : {}
    out.push({
      id,
      title,
      description: isStr(description) ? description : '',
      dueDate: isStr(dueDate) && validDue(dueDate) ? dueDate : '',
      status,
      repo: isStr(repo) ? repo : '',
      worktree: { displayName: isStr(w.displayName) ? w.displayName : '', branch: isStr(w.branch) ? w.branch : '' },
      at: typeof at === 'number' && Number.isFinite(at) ? at : 0,
    })
  }
  return out
}

export function addTask(
  tasks: Task[],
  input: { title: string; description?: string; dueDate?: string; repo: string; worktree: Worktree; status?: Status },
  now: number,
  newId: () => string,
): Task[] {
  const title = input.title.trim()
  if (!title) return tasks
  const dueDate = input.dueDate && validDue(input.dueDate) ? input.dueDate : ''
  const description = input.description ?? ''
  return [...tasks, { id: newId(), title, description, dueDate, status: input.status ?? 'todo', repo: input.repo, worktree: input.worktree, at: now }]
}

const patch = (tasks: Task[], id: string, p: Partial<Task>): Task[] => tasks.map((t) => (t.id === id ? { ...t, ...p } : t))

export const setStatus = (tasks: Task[], id: string, status: Status): Task[] => patch(tasks, id, { status })
export const setRepo = (tasks: Task[], id: string, repo: string): Task[] => patch(tasks, id, { repo })
export const removeTask = (tasks: Task[], id: string): Task[] => tasks.filter((t) => t.id !== id)
export const clearCompleted = (tasks: Task[]): Task[] => tasks.filter((t) => t.status !== 'completed')

export const forWorktree = (tasks: Task[], wt: Worktree): Task[] =>
  tasks.filter((t) => t.worktree.displayName === wt.displayName && t.worktree.branch === wt.branch)

export const repoOptions = (tasks: Task[], found: string[]): string[] =>
  [...new Set([...found, ...tasks.map((t) => t.repo)].filter(Boolean))].sort()

/** status '' and repo '' mean any. */
export const filterTasks = (tasks: Task[], f: { status: Status | ''; repo: string }): Task[] =>
  tasks.filter((t) => (!f.status || t.status === f.status) && (!f.repo || t.repo === f.repo))
