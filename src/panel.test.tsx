import { assert, mockHost, mount, test } from 'orca/testing'
import * as panel from './panel'

const wt = { displayName: 'wt', branch: 'main' }
const other = { displayName: 'other', branch: 'dev' }
const task = (id: string, text: string, status: string, worktree = wt, repo = 'proj') => ({ id, text, status, repo, worktree, at: 1 })

function host(tasks?: unknown, extra: Record<string, unknown> = {}) {
  return mockHost({
    storage: tasks === undefined ? {} : { tasks: tasks as never },
    results: { 'workspace.readContext': { ...wt, terminals: [] }, ...extra },
    requests: { repoContext: { repo: 'proj', repos: ['proj', 'zed'] } }
  })
}
const stored = (view: { persisted: { storage: Record<string, unknown> } }) => view.persisted.storage.tasks as any[]
const done = (view: any) => {
  assert.deepEqual(view.errors, [])
  assert.deepEqual(view.refusals, [])
  assert.deepEqual(view.warnings, [])
}

test('empty state shows when there are no tasks', async () => {
  const view = await mount(panel, { host: host() })
  assert.ok(view.find({ type: 'EmptyState' }))
  done(view)
  await view.unmount()
})

test('adding a task with the Add button appends a todo row with the repo from repoContext', async () => {
  const h = host()
  const view = await mount(panel, { host: h })
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'write docs')
  await view.press({ text: 'เพิ่ม' })
  const [t] = stored(view)
  assert.equal(stored(view).length, 1)
  assert.equal(t.text, 'write docs')
  assert.equal(t.status, 'todo')
  assert.equal(t.repo, 'proj')
  assert.deepEqual(t.worktree, wt)
  assert.deepEqual(h.callsOf('plugin.request')[0], { name: 'repoContext', input: wt })
  assert.equal(view.find({ type: 'EmptyState' }), null)
  assert.ok(view.find({ text: 'write docs' }))
  assert.equal(view.valueOf({ type: 'Input', label: 'งานใหม่' }), '')
  done(view)
  await view.unmount()
})

test('Enter in the input adds the task, blank text is ignored', async () => {
  const view = await mount(panel, { host: host() })
  await view.type({ type: 'Input', label: 'งานใหม่' }, '   ', { submit: true })
  assert.equal(stored(view), undefined)
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'by enter', { submit: true })
  assert.equal(stored(view)[0].text, 'by enter')
  done(view)
  await view.unmount()
})

test('tab "worktree นี้" shows only the focused worktree; "ทั้งหมด" shows all', async () => {
  const view = await mount(panel, { host: host([task('1', 'mine', 'todo'), task('2', 'theirs', 'todo', other)]) })
  assert.ok(view.find({ text: 'mine' }))
  assert.ok(view.find({ text: 'theirs' }))
  await view.select({ type: 'Tabs' }, 'worktree')
  assert.ok(view.find({ text: 'mine' }))
  assert.equal(view.find({ text: 'theirs' }), null)
  await view.select({ type: 'Tabs' }, 'all')
  assert.ok(view.find({ text: 'theirs' }))
  done(view)
  await view.unmount()
})

test("changing a row's status Select updates that task", async () => {
  const view = await mount(panel, { host: host([task('1', 'a', 'todo'), task('2', 'b', 'todo')]) })
  await view.select({ testId: 'status-2' }, 'in-review')
  assert.deepEqual(stored(view).map((t) => t.status), ['todo', 'in-review'])
  done(view)
  await view.unmount()
})

test('"ล้างที่เสร็จแล้ว" removes only completed tasks', async () => {
  const view = await mount(panel, { host: host([task('1', 'a', 'completed'), task('2', 'b', 'in-progress')]) })
  await view.press({ text: 'ล้างที่เสร็จแล้ว' })
  assert.deepEqual(stored(view).map((t) => t.id), ['2'])
  done(view)
  await view.unmount()
})

test('delete button removes one task', async () => {
  const view = await mount(panel, { host: host([task('1', 'a', 'todo'), task('2', 'b', 'todo')]) })
  await view.press({ testId: 'delete-1' })
  assert.deepEqual(stored(view).map((t) => t.id), ['2'])
  await view.unmount()
})

test('markup text renders literally', async () => {
  const view = await mount(panel, { host: host() })
  await view.type({ type: 'Input', label: 'งานใหม่' }, '<b>x</b>', { submit: true })
  assert.ok(view.find({ text: '<b>x</b>' }))
  done(view)
  await view.unmount()
})

test('corrupt stored tasks render the empty state and are not written back', async () => {
  const view = await mount(panel, { host: host({}) })
  assert.ok(view.find({ type: 'EmptyState' }))
  assert.deepEqual(stored(view), {})
  done(view)
  await view.unmount()
})

test('malformed stored items are not dropped from storage until the user edits', async () => {
  const raw = [task('1', 'ok', 'todo'), { junk: true }]
  const view = await mount(panel, { host: host(raw) })
  assert.deepEqual(stored(view), raw)
  await view.unmount()
})

test('workspace.changed asks repoContext again; no focused workspace gives repo ""', async () => {
  const h = host()
  const view = await mount(panel, { host: h })
  await view.emit('workspace.changed', { context: null })
  assert.equal(h.callsOf('plugin.request').length >= 2, true)
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'x', { submit: true })
  assert.equal(stored(view)[0].repo, '')
  done(view)
  await view.unmount()
})

test('with no known repo the repo is typed in an Input', async () => {
  const h = mockHost({ results: { 'workspace.readContext': null }, requests: { repoContext: { repo: '', repos: [] } } })
  const view = await mount(panel, { host: h })
  await view.type({ type: 'Input', label: 'repo' }, 'mine')
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'x', { submit: true })
  assert.equal(stored(view)[0].repo, 'mine')
  done(view)
  await view.unmount()
})
