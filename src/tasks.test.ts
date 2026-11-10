import { assert, test } from 'orca/testing'
import {
  addTask,
  clearCompleted,
  forWorktree,
  parseTasks,
  removeTask,
  repoOptions,
  setRepo,
  setStatus,
  type Task,
  type Worktree,
} from './tasks'

const worktree: Worktree = { displayName: 'main-wt', branch: 'main' }
const other: Worktree = { displayName: 'other-wt', branch: 'feature' }
const mk = (id: string, status: Task['status'] = 'todo', wt = worktree, repo = 'r'): Task => ({
  id,
  text: id,
  status,
  repo,
  worktree: wt,
  at: 1,
})

test('addTask trims text and defaults status to todo', () => {
  const out = addTask([], { text: '  แก้บั๊กลา  ', repo: 'humanos-irpc', worktree }, 1, () => 'a')
  assert.equal(out.length, 1)
  assert.equal(out[0].text, 'แก้บั๊กลา')
  assert.equal(out[0].status, 'todo')
  assert.equal(out[0].at, 1)
  assert.equal(out[0].id, 'a')
})

test('addTask ignores empty and whitespace-only text', () => {
  const base = [mk('x')]
  for (const text of ['', '   ']) {
    assert.deepEqual(addTask(base, { text, repo: 'r', worktree }, 1, () => 'a'), base)
  }
})

test('addTask keeps markup as literal text', () => {
  const out = addTask([], { text: '<b>x</b>', repo: 'r', worktree }, 1, () => 'a')
  assert.equal(out[0].text, '<b>x</b>')
})

test('addTask allows duplicate text with distinct ids', () => {
  const one = addTask([], { text: 'same', repo: 'r', worktree }, 1, () => 'a')
  const two = addTask(one, { text: 'same', repo: 'r', worktree }, 2, () => 'b')
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
    { ...good, text: undefined },
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
