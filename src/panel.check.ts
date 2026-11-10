// `orca plugin check` renders the panel once per scenario, each with the worker on a fresh host.
import { defineCheck } from 'orca/testing'

const wt = { displayName: 'wt', branch: 'main' }
const task = (id: string, text: string, status: string) => ({ id, title: text, description: id === '1' ? 'details' : '', dueDate: id === '2' ? '2000-01-01' : '', status, repo: id === '1' ? '' : 'proj', worktree: wt, at: 1 })

export default defineCheck({
  fresh: {},
  populated: {
    storage: { tasks: [task('1', 'write docs', 'todo'), task('2', 'fix bug', 'in-progress'), task('3', 'ship', 'completed')] }
  },
  corrupt: { storage: { tasks: {} } }
})
