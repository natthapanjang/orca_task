import { assert, test } from 'orca/testing'
import {
  addTask,
  filterTasks,
  clearCompleted,
  forWorktree,
  parseTasks,
  removeTask,
  repoOptions,
  setRepo,
  setStatus,
  validDue,
  type Task,
  type Worktree,
} from './tasks'

const worktree: Worktree = { displayName: 'main-wt', branch: 'main' }
const other: Worktree = { displayName: 'other-wt', branch: 'feature' }
const mk = (id: string, status: Task['status'] = 'todo', wt = worktree, repo = 'r'): Task => ({
  id,
  title: id,
  description: '',
  dueDate: '',
  status,
  repo,
  worktree: wt,
  at: 1,
})

test('addTask trims text and defaults status to todo', () => {
  const out = addTask([], { title: '  แก้บั๊กลา  ', repo: 'humanos-irpc', worktree }, 1, () => 'a')
  assert.equal(out.length, 1)
  assert.equal(out[0].title, 'แก้บั๊กลา')
  assert.equal(out[0].status, 'todo')
  assert.equal(out[0].at, 1)
  assert.equal(out[0].id, 'a')
})

test('addTask ignores empty and whitespace-only text', () => {
  const base = [mk('x')]
  for (const text of ['', '   ']) {
    assert.deepEqual(addTask(base, { title: text, repo: 'r', worktree }, 1, () => 'a'), base)
  }
})

test('addTask keeps markup as literal text', () => {
  const out = addTask([], { title: '<b>x</b>', repo: 'r', worktree }, 1, () => 'a')
  assert.equal(out[0].title, '<b>x</b>')
})

test('addTask allows duplicate text with distinct ids', () => {
  const one = addTask([], { title: 'same', repo: 'r', worktree }, 1, () => 'a')
  const two = addTask(one, { title: 'same', repo: 'r', worktree }, 2, () => 'b')
  assert.equal(two.length, 2)
  assert.equal(one.length, 1)
})

test('setStatus, setRepo, removeTask change only the matching id', () => {
  const tasks = [mk('a'), mk('b')]
  assert.deepEqual(setStatus(tasks, 'a', 'completed').map((t) => t.status), ['completed', 'todo'])
  assert.deepEqual(setRepo(tasks, 'b', 'z').map((t) => t.repo), ['r', 'z'])
  assert.deepEqual(removeTask(tasks, 'a').map((t) => t.id), ['b'])
  assert.deepEqual(tasks.map((t) => t.status), ['todo', 'todo'])
})

test('clearCompleted drops only completed', () => {
  const tasks = [mk('a', 'completed'), mk('b', 'in-review'), mk('c', 'todo')]
  assert.deepEqual(clearCompleted(tasks).map((t) => t.id), ['b', 'c'])
})

test('forWorktree matches displayName and branch', () => {
  const tasks = [mk('a'), mk('b', 'todo', other)]
  assert.deepEqual(forWorktree(tasks, { ...worktree }).map((t) => t.id), ['a'])
  assert.deepEqual(forWorktree(tasks, { displayName: 'main-wt', branch: 'feature' }), [])
})

test('parseTasks returns [] for undefined, null, {} and strings', () => {
  for (const raw of [undefined, null, {}, 'x', 5]) assert.deepEqual(parseTasks(raw), [])
})

test('parseTasks drops items missing id, text or a valid status', () => {
  const good = mk('ok')
  const out = parseTasks([
    good,
    null,
    'x',
    { ...good, id: undefined },
    { ...good, title: undefined },
    { ...good, status: 'bogus' },
  ])
  assert.deepEqual(out, [good])
})

test('parseTasks defaults bad repo, at and worktree instead of dropping', () => {
  const good = mk('ok')
  const blankWt = { displayName: '', branch: '' }
  const out = parseTasks([
    { ...good, id: 'r', repo: 5 },
    { ...good, id: 'a', at: 'nan' },
    { ...good, id: 'w', worktree: null },
    { ...good, id: 'p', worktree: { displayName: 'only' } },
  ])
  assert.deepEqual(out, [
    { ...good, id: 'r', repo: '' },
    { ...good, id: 'a', at: 0 },
    { ...good, id: 'w', worktree: blankWt },
    { ...good, id: 'p', worktree: { displayName: 'only', branch: '' } },
  ])
})

test('parseTasks keeps an item missing only repo or only at', () => {
  const { repo, ...noRepo } = mk('r')
  const { at, ...noAt } = mk('a')
  assert.deepEqual(parseTasks([noRepo, noAt]), [{ ...mk('r'), repo: '' }, { ...mk('a'), at: 0 }])
})

test('repoOptions includes repos found only on tasks', () => {
  assert.deepEqual(repoOptions([mk('a', 'todo', worktree, 'old'), mk('b', 'todo', worktree, '')], ['new', '']), ['new', 'old'])
})

test('addTask stores description and dueDate; an invalid dueDate is stored as empty', () => {
  const ok = addTask([], { title: 't', description: ' d ', dueDate: '2026-12-31', repo: 'r', worktree }, 1, () => 'a')
  assert.equal(ok[0].description, ' d ')
  assert.equal(ok[0].dueDate, '2026-12-31')
  const bad = addTask([], { title: 't', description: '', dueDate: '2026-02-30', repo: 'r', worktree }, 1, () => 'a')
  assert.equal(bad[0].dueDate, '')
})

test('validDue accepts empty and real calendar dates only', () => {
  for (const s of ['', '2026-02-28', '2028-02-29']) assert.equal(validDue(s), true)
  for (const s of ['2026-02-30', '2026-13-01', 'abc', '2026-1-1', '2026-01-01x']) assert.equal(validDue(s), false)
})

test('parseTasks reads legacy text as title and defaults description and dueDate', () => {
  const { title, description, dueDate, ...rest } = mk('l')
  assert.deepEqual(parseTasks([{ ...rest, text: 'old' }]), [{ ...mk('l'), title: 'old' }])
  assert.deepEqual(parseTasks([{ ...mk('d'), dueDate: 'abc', description: 5 }]), [mk('d')])
})

test('filterTasks combines status and repo; empty means any', () => {
  const tasks = [mk('a', 'todo', worktree, 'x'), mk('b', 'completed', worktree, 'x'), mk('c', 'todo', worktree, 'y'), mk('d', 'todo', worktree, '')]
  const ids = (f: Parameters<typeof filterTasks>[1]) => filterTasks(tasks, f).map((t) => t.id)
  assert.deepEqual(ids({ status: '', repo: '' }), ['a', 'b', 'c', 'd'])
  assert.deepEqual(ids({ status: 'todo', repo: '' }), ['a', 'c', 'd'])
  assert.deepEqual(ids({ status: '', repo: 'x' }), ['a', 'b'])
  assert.deepEqual(ids({ status: 'todo', repo: 'x' }), ['a'])
})
