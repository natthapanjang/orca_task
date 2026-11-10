export type Status = 'todo' | 'in-progress' | 'in-review' | 'completed'
export const STATUSES: readonly Status[] = ['todo', 'in-progress', 'in-review', 'completed']

export type Worktree = { displayName: string; branch: string }
export type Task = { id: string; text: string; status: Status; repo: string; worktree: Worktree; at: number }

const isStr = (v: unknown): v is string => typeof v === 'string'

// Only id, text and status are required; bad repo/worktree/at fall back to defaults so hand-edited items survive.
export function parseTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return []
  const out: Task[] = []
  for (const it of raw) {
    if (typeof it !== 'object' || it === null) continue
    const { id, text, status, repo, worktree: wt, at } = it as Record<string, any>
    if (!isStr(id) || !isStr(text) || !text.trim() || !STATUSES.includes(status)) continue
    const w = typeof wt === 'object' && wt !== null ? wt : {}
    out.push({
      id,
      text,
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
  input: { text: string; repo: string; worktree: Worktree; status?: Status },
  now: number,
  newId: () => string,
): Task[] {
  const text = input.text.trim()
  if (!text) return tasks
  return [...tasks, { id: newId(), text, status: input.status ?? 'todo', repo: input.repo, worktree: input.worktree, at: now }]
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
