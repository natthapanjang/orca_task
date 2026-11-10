import { assert, mockHost, mount, test } from 'orca/testing'
import * as panel from './panel'

const wt = { displayName: 'wt', branch: 'main' }
const other = { displayName: 'other', branch: 'dev' }
const task = (id: string, text: string, status: string, worktree = wt, repo = 'proj') => ({ id, title: text, description: '', dueDate: '', status, repo, worktree, at: 1 })

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
  assert.equal(t.title, 'write docs')
  assert.equal(t.status, 'todo')
  assert.equal(t.repo, 'proj')
  assert.deepEqual(t.worktree, wt)
  assert.deepEqual(h.callsOf('plugin.request')[0], { name: 'repoContext', input: wt })
  assert.equal(view.find({ type: 'EmptyState' }), null)
  assert.ok(view.find({ type: 'Checkbox', label: 'write docs' }))
  assert.equal(view.valueOf({ type: 'Input', label: 'งานใหม่' }), '')
  done(view)
  await view.unmount()
})

test('Enter in the input adds the task, blank text is ignored', async () => {
  const view = await mount(panel, { host: host() })
  await view.type({ type: 'Input', label: 'งานใหม่' }, '   ', { submit: true })
  assert.equal(stored(view), undefined)
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'by enter', { submit: true })
  assert.equal(stored(view)[0].title, 'by enter')
  done(view)
  await view.unmount()
})

test('tab "worktree นี้" shows only the focused worktree; "ทั้งหมด" shows all', async () => {
  const view = await mount(panel, { host: host([task('1', 'mine', 'todo'), task('2', 'theirs', 'todo', other)]) })
  assert.ok(view.find({ type: 'Checkbox', label: 'mine' }))
  assert.ok(view.find({ type: 'Checkbox', label: 'theirs' }))
  await view.select({ type: 'Tabs' }, 'worktree')
  assert.ok(view.find({ type: 'Checkbox', label: 'mine' }))
  assert.equal(view.find({ type: 'Checkbox', label: 'theirs' }), null)
  await view.select({ type: 'Tabs' }, 'all')
  assert.ok(view.find({ type: 'Checkbox', label: 'theirs' }))
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
  assert.ok(view.find({ type: 'Checkbox', label: '<b>x</b>' }))
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

test("changing a row's repo updates that task and leaves the new-task default alone", async () => {
  const view = await mount(panel, { host: host([task('1', 'a', 'todo'), task('2', 'b', 'todo')]) })
  await view.press({ testId: 'edit-2' })
  await view.select({ testId: 'repo-2' }, 'zed')
  assert.deepEqual(stored(view).map((t) => t.repo), ['proj', 'zed'])
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'c', { submit: true })
  assert.equal(stored(view)[2].repo, 'proj')
  done(view)
  await view.unmount()
})

test("with no known repo a row's repo is typed in an Input", async () => {
  const h = mockHost({ storage: { tasks: [task('1', 'a', 'todo', wt, '')] }, results: { 'workspace.readContext': null }, requests: { repoContext: { repo: '', repos: [] } } })
  const view = await mount(panel, { host: h })
  await view.press({ testId: 'edit-1' })
  await view.type({ testId: 'repo-1' }, 'mine', { submit: true })
  assert.equal(stored(view)[0].repo, 'mine')
  done(view)
  await view.unmount()
})

const answers = (input: { displayName: string }) =>
  input.displayName === 'other' ? { repo: 'otherrepo', repos: ['otherrepo', 'proj', 'zed'] } : { repo: 'proj', repos: ['proj', 'zed'] }

test("a picked repo is dropped when the focused worktree changes: new tasks get the new worktree's repo", async () => {
  const h = mockHost({ results: { 'workspace.readContext': { ...wt, terminals: [] } }, requests: { repoContext: answers } })
  const view = await mount(panel, { host: h })
  await view.select({ type: 'Select', label: 'repo' }, 'zed')
  await view.emit('workspace.changed', { context: { ...other, terminals: [] } })
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'x', { submit: true })
  assert.equal(stored(view)[0].repo, 'otherrepo')
  assert.deepEqual(stored(view)[0].worktree, other)
  done(view)
  await view.unmount()
})

test('workspace.changed for the same worktree (terminals only) keeps the picked repo', async () => {
  const view = await mount(panel, { host: host() })
  await view.select({ type: 'Select', label: 'repo' }, 'zed')
  await view.emit('workspace.changed', { context: { ...wt, terminals: [{ id: 't1', title: 'sh' }] } })
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'x', { submit: true })
  assert.equal(stored(view)[0].repo, 'zed')
  done(view)
  await view.unmount()
})

test('an older repoContext answer arriving late does not overwrite the newer one', async () => {
  const third = { displayName: 'third', branch: 'x' }
  const h = mockHost({
    results: { 'workspace.readContext': { ...wt, terminals: [] } },
    // 'other' is asked first but answers last
    requests: {
      repoContext: (input: { displayName: string }) =>
        input.displayName === 'other' ? (new Promise((r) => setTimeout(() => r({ repo: 'stale', repos: ['stale'] }), 50)) as any) : input.displayName === 'third' ? { repo: 'thirdrepo', repos: ['thirdrepo'] } : answers(input)
    }
  })
  const view = await mount(panel, { host: h })
  await Promise.all([view.emit('workspace.changed', { context: { ...other, terminals: [] } }), view.emit('workspace.changed', { context: { ...third, terminals: [] } })])
  await new Promise((r) => setTimeout(r, 150))
  await view.settled()
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'x', { submit: true })
  assert.equal(stored(view)[0].repo, 'thirdrepo')
  done(view)
  await view.unmount()
})

test('Add with blank text shows the error, writes nothing, and typing clears it', async () => {
  const view = await mount(panel, { host: host() })
  await view.press({ text: 'เพิ่ม' })
  assert.equal(stored(view), undefined)
  const shown = () => JSON.stringify(view.tree()).includes('พิมพ์ข้อความงานก่อน')
  assert.equal(shown(), true)
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'x')
  assert.equal(shown(), false)
  done(view)
  await view.unmount()
})

test('the status picked in the add form is stored on the new task', async () => {
  const view = await mount(panel, { host: host() })
  await view.select({ type: 'Select', label: 'สถานะ' }, 'in-progress')
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'x', { submit: true })
  assert.equal(stored(view)[0].status, 'in-progress')
  done(view)
  await view.unmount()
})

test('the checkbox sets completed, and unticking sets todo', async () => {
  const open = await mount(panel, { host: host([task('1', 'a', 'in-progress')]) })
  await open.toggle({ testId: 'done-1' })
  assert.equal(stored(open)[0].status, 'completed')
  done(open)
  await open.unmount()
  const finished = await mount(panel, { host: host([task('1', 'a', 'completed')]) })
  await finished.toggle({ testId: 'done-1' })
  assert.equal(stored(finished)[0].status, 'todo')
  done(finished)
  await finished.unmount()
})

test('the footer counts unfinished tasks of the visible tab and clearing only touches that tab', async () => {
  const view = await mount(panel, { host: host([task('1', 'a', 'todo'), task('2', 'b', 'completed'), task('3', 'c', 'completed', other)]) })
  assert.ok(view.find({ text: 'เหลือ 1 งาน' }))
  await view.select({ type: 'Tabs' }, 'worktree')
  await view.press({ text: 'ล้างที่เสร็จแล้ว' })
  assert.deepEqual(stored(view).map((t) => t.id), ['1', '3'])
  done(view)
  await view.unmount()
})

test('description and a valid due date are stored and shown on the row', async () => {
  const view = await mount(panel, { host: host() })
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'ship it')
  await view.type({ type: 'Textarea', label: 'รายละเอียด' }, 'before the demo')
  await view.type({ type: 'Input', label: 'วันครบกำหนด' }, '2999-12-31')
  await view.press({ text: 'เพิ่ม' })
  const [t] = stored(view)
  assert.equal(t.description, 'before the demo')
  assert.equal(t.dueDate, '2999-12-31')
  assert.ok(view.find({ text: 'before the demo' }))
  assert.ok(view.find({ text: '2999-12-31' }))
  done(view)
  await view.unmount()
})

test('an invalid due date blocks Add, shows an error, and typing clears it', async () => {
  const view = await mount(panel, { host: host() })
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'x')
  await view.type({ type: 'Input', label: 'วันครบกำหนด' }, '2026-02-30')
  await view.press({ text: 'เพิ่ม' })
  assert.equal(stored(view), undefined)
  const shown = () => JSON.stringify(view.tree()).includes('วันที่ต้องเป็น YYYY-MM-DD')
  assert.equal(shown(), true)
  await view.type({ type: 'Input', label: 'วันครบกำหนด' }, '2026-02-28')
  assert.equal(shown(), false)
  done(view)
  await view.unmount()
})

test('legacy stored items with text show as titles', async () => {
  const legacy = { id: '1', text: 'old one', status: 'todo', repo: 'proj', worktree: wt, at: 1 }
  const view = await mount(panel, { host: host([legacy]) })
  assert.ok(view.find({ type: 'Checkbox', label: 'old one' }))
  done(view)
  await view.unmount()
})

test('status and repo filters narrow the list together with the tab', async () => {
  const list = [task('1', 'a', 'todo', wt, 'proj'), task('2', 'b', 'completed', wt, 'proj'), task('3', 'c', 'todo', wt, 'zed'), task('4', 'd', 'todo', other, 'zed')]
  const view = await mount(panel, { host: host(list) })
  const has = (l: string) => view.find({ type: 'Checkbox', label: l }) !== null
  await view.select({ testId: 'filter-status' }, 'todo')
  assert.deepEqual(['a', 'b', 'c', 'd'].filter(has), ['a', 'c', 'd'])
  await view.select({ testId: 'filter-repo' }, 'zed')
  assert.deepEqual(['a', 'b', 'c', 'd'].filter(has), ['c', 'd'])
  await view.select({ type: 'Tabs' }, 'worktree')
  assert.deepEqual(['a', 'b', 'c', 'd'].filter(has), ['c'])
  await view.select({ testId: 'filter-status' }, 'all')
  await view.select({ testId: 'filter-repo' }, 'all')
  assert.deepEqual(['a', 'b', 'c', 'd'].filter(has), ['a', 'b', 'c'])
  done(view)
  await view.unmount()
})

test('a repo filter whose repo vanished falls back to all instead of hiding everything', async () => {
  const view = await mount(panel, { host: host([task('1', 'a', 'todo', wt, 'proj'), task('2', 'b', 'todo', wt, 'gone')]) })
  await view.select({ testId: 'filter-repo' }, 'gone')
  await view.press({ testId: 'delete-2' })
  assert.ok(view.find({ type: 'Checkbox', label: 'a' }))
  done(view)
  await view.unmount()
})

test('with a filter active, an empty list says no task matches, not that there are none', async () => {
  const view = await mount(panel, { host: host([task('1', 'a', 'todo')]) })
  await view.select({ testId: 'filter-status' }, 'in-review')
  const tree = JSON.stringify(view.tree())
  assert.equal(tree.includes('ไม่มีงานตรงตัวกรอง'), true)
  assert.equal(tree.includes('ยังไม่มีงาน'), false)
  done(view)
  await view.unmount()
})

test('clearing completed under a filter removes only the visible completed tasks', async () => {
  const list = [task('1', 'a', 'completed', wt, 'proj'), task('2', 'b', 'completed', wt, 'zed'), task('3', 'c', 'todo', wt, 'zed')]
  const view = await mount(panel, { host: host(list) })
  await view.select({ testId: 'filter-repo' }, 'zed')
  assert.ok(view.find({ text: 'เหลือ 1 งาน' }))
  await view.press({ text: 'ล้างที่เสร็จแล้ว' })
  assert.deepEqual(stored(view).map((t) => t.id), ['1', '3'])
  done(view)
  await view.unmount()
})

test('markup in a description renders literally', async () => {
  const view = await mount(panel, { host: host() })
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'x')
  await view.type({ type: 'Textarea', label: 'รายละเอียด' }, '<script>y</script>')
  await view.press({ text: 'เพิ่ม' })
  assert.ok(view.find({ text: '<script>y</script>' }))
  done(view)
  await view.unmount()
})
