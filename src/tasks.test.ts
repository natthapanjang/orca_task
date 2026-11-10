import { assert, test } from 'orca/testing'
import {
  addTask,
  filterTasks,
  clearCompleted,
  dueBadge,
  daysUntil,
  NO_REPO,
  sortTasks,
  todayLocal,
  updateTask,
  forWorktree,
  parseTasks,
  removeTask,
  repoOptions,
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

test('setStatus, removeTask change only the matching id', () => {
  const tasks = [mk('a'), mk('b')]
  assert.deepEqual(setStatus(tasks, 'a', 'completed').map((t) => t.status), ['completed', 'todo'])
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

test('daysUntil counts whole days across month end, year end and a leap day', () => {
  assert.equal(daysUntil('2026-03-01', '2026-02-28'), 1)
  assert.equal(daysUntil('2028-03-01', '2028-02-28'), 2)
  assert.equal(daysUntil('2027-01-01', '2026-12-31'), 1)
  assert.equal(daysUntil('2026-05-01', '2026-05-02'), -1)
})

test('todayLocal is the local date as YYYY-MM-DD', () => {
  assert.equal(todayLocal(new Date(2026, 0, 5)), '2026-01-05')
})

test('dueBadge shows urgency as text, plain date when later or completed, null without a date', () => {
  const b = (dueDate: string, status: Task['status'] = 'todo') => dueBadge({ dueDate, status }, '2026-06-10')
  assert.deepEqual(b('2026-06-07'), { text: 'เลยกำหนด 3 วัน', tone: 'danger' })
  assert.deepEqual(b('2026-06-10'), { text: 'ครบวันนี้', tone: 'warning' })
  assert.deepEqual(b('2026-06-11'), { text: 'ครบอีก 1 วัน', tone: 'neutral' })
  assert.deepEqual(b('2026-06-12'), { text: 'ครบอีก 2 วัน', tone: 'neutral' })
  assert.deepEqual(b('2026-06-13'), { text: '2026-06-13', tone: 'neutral' })
  assert.deepEqual(b('2026-06-07', 'completed'), { text: '2026-06-07', tone: 'neutral' })
  assert.equal(b(''), null)
})

test('sortTasks: unfinished first, due ascending with no-due last, then at; stable; input untouched', () => {
  const t = (id: string, dueDate: string, status: Task['status'] = 'todo', at = 1): Task => ({ ...mk(id, status), dueDate, at })
  const input = [t('done-early', '2026-01-01', 'completed'), t('none', ''), t('due-late', '2026-09-01'), t('due-early', '2026-02-01')]
  const copy = [...input]
  assert.deepEqual(sortTasks(input).map((x) => x.id), ['due-early', 'due-late', 'none', 'done-early'])
  assert.deepEqual(input, copy)
  assert.deepEqual(sortTasks([t('a', '', 'todo', 5), t('b', '', 'todo', 2)]).map((x) => x.id), ['b', 'a'])
  assert.deepEqual(sortTasks([t('x', '2026-02-01'), t('y', '2026-02-01')]).map((x) => x.id), ['x', 'y'])
})

test('filterTasks with NO_REPO keeps only tasks without a repo and combines with status', () => {
  const tasks = [mk('a', 'todo', worktree, ''), mk('b', 'completed', worktree, ''), mk('c', 'todo', worktree, 'x')]
  assert.deepEqual(filterTasks(tasks, { status: '', repo: NO_REPO }).map((t) => t.id), ['a', 'b'])
  assert.deepEqual(filterTasks(tasks, { status: 'todo', repo: NO_REPO }).map((t) => t.id), ['a'])
})

test('updateTask changes only the matching id and trims the title', () => {
  const tasks = [mk('a'), mk('b')]
  const out = updateTask(tasks, 'a', { title: '  new  ', description: 'd', dueDate: '2026-02-01', repo: 'z', status: 'in-review' })
  assert.deepEqual(out[0], { ...tasks[0], title: 'new', description: 'd', dueDate: '2026-02-01', repo: 'z', status: 'in-review' })
  assert.equal(out[1], tasks[1])
})

test('updateTask rejects a blank title or an impossible date by returning the same array; empty date clears', () => {
  const tasks = [{ ...mk('a'), dueDate: '2026-02-01' }]
  assert.equal(updateTask(tasks, 'a', { title: '   ' }), tasks)
  assert.equal(updateTask(tasks, 'a', { dueDate: '2026-02-30' }), tasks)
  assert.equal(updateTask(tasks, 'a', { dueDate: '' })[0].dueDate, '')
})
