import { assert, mockHost, mount, test } from 'orca/testing'
import * as panel from './panel'
import { NO_REPO, todayLocal } from './tasks'

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
  await view.press({ testId: 'more-toggle' })
  await view.type({ type: 'Input', label: 'repo' }, 'mine')
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'x', { submit: true })
  assert.equal(stored(view)[0].repo, 'mine')
  done(view)
  await view.unmount()
})

const rows = () => [task('1', 'a', 'todo'), { ...task('2', 'b', 'todo'), description: 'old desc', dueDate: '2999-01-01' }]
const text = (view: any) => JSON.stringify(view.tree())

test('edit replaces only that row with pre-filled fields; editing another row moves edit mode', async () => {
  const view = await mount(panel, { host: host(rows()) })
  await view.press({ testId: 'edit-2' })
  assert.equal(view.valueOf({ testId: 'edit-title-2' }), 'b')
  assert.equal(view.valueOf({ testId: 'edit-desc-2' }), 'old desc')
  assert.equal(view.valueOf({ testId: 'edit-due-2' }), '2999-01-01')
  assert.equal(view.valueOf({ testId: 'edit-repo-2' }), 'proj')
  assert.equal(view.valueOf({ testId: 'edit-status-2' }), 'todo')
  assert.ok(view.find({ type: 'Checkbox', label: 'a' }))
  assert.equal(view.find({ type: 'Checkbox', label: 'b' }), null)
  await view.press({ testId: 'edit-1' })
  assert.ok(view.find({ testId: 'edit-title-1' }))
  assert.equal(view.find({ testId: 'edit-title-2' }), null)
  assert.ok(view.find({ type: 'Checkbox', label: 'b' }))
  done(view)
  await view.unmount()
})

test('saving an edit changes every field of that task only and leaves the new-task default repo alone', async () => {
  const view = await mount(panel, { host: host(rows()) })
  await view.press({ testId: 'edit-2' })
  await view.type({ testId: 'edit-title-2' }, ' new title ', { replace: true })
  await view.type({ testId: 'edit-desc-2' }, 'new desc', { replace: true })
  await view.type({ testId: 'edit-due-2' }, '2999-02-02', { replace: true })
  await view.select({ testId: 'edit-repo-2' }, 'zed')
  await view.select({ testId: 'edit-status-2' }, 'in-review')
  await view.press({ testId: 'save-2' })
  assert.deepEqual(stored(view)[0], rows()[0])
  const t = stored(view)[1]
  assert.deepEqual([t.title, t.description, t.dueDate, t.repo, t.status], ['new title', 'new desc', '2999-02-02', 'zed', 'in-review'])
  assert.ok(view.find({ type: 'Checkbox', label: 'new title' }))
  assert.equal(view.find({ testId: 'edit-title-2' }), null)
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'c', { submit: true })
  assert.equal(stored(view)[2].repo, 'proj')
  done(view)
  await view.unmount()
})

test('saving with a blank title or an impossible date shows the error, keeps the row open, writes nothing', async () => {
  const view = await mount(panel, { host: host(rows()) })
  await view.press({ testId: 'edit-2' })
  await view.type({ testId: 'edit-title-2' }, '   ', { replace: true })
  await view.press({ testId: 'save-2' })
  assert.equal(text(view).includes('พิมพ์ข้อความงานก่อน'), true)
  assert.ok(view.find({ testId: 'edit-title-2' }))
  await view.type({ testId: 'edit-title-2' }, 'ok', { replace: true })
  assert.equal(text(view).includes('พิมพ์ข้อความงานก่อน'), false)
  await view.type({ testId: 'edit-due-2' }, '2026-02-30', { replace: true })
  await view.press({ testId: 'save-2' })
  assert.equal(text(view).includes('วันที่ต้องเป็น YYYY-MM-DD'), true)
  assert.ok(view.find({ testId: 'edit-title-2' }))
  assert.deepEqual(stored(view), rows())
  done(view)
  await view.unmount()
})

test('cancel restores the row and writes nothing', async () => {
  const view = await mount(panel, { host: host(rows()) })
  await view.press({ testId: 'edit-2' })
  await view.type({ testId: 'edit-title-2' }, 'changed', { replace: true })
  await view.press({ testId: 'cancel-2' })
  assert.ok(view.find({ type: 'Checkbox', label: 'b' }))
  assert.deepEqual(stored(view), rows())
  done(view)
  await view.unmount()
})

test("with no known repo the edit form's repo is a typed Input and saves its text", async () => {
  const h = mockHost({ storage: { tasks: [task('1', 'a', 'todo', wt, '')] }, results: { 'workspace.readContext': null }, requests: { repoContext: { repo: '', repos: [] } } })
  const view = await mount(panel, { host: h })
  await view.press({ testId: 'edit-1' })
  await view.type({ testId: 'edit-repo-1' }, 'mine', { replace: true })
  await view.press({ testId: 'save-1' })
  assert.equal(stored(view)[0].repo, 'mine')
  done(view)
  await view.unmount()
})

test('a row in edit mode hidden by a filter is still editing when shown again', async () => {
  const view = await mount(panel, { host: host(rows()) })
  await view.press({ testId: 'edit-2' })
  await view.type({ testId: 'edit-title-2' }, 'half done', { replace: true })
  await view.select({ testId: 'filter-status' }, 'completed')
  assert.equal(view.find({ testId: 'edit-title-2' }), null)
  await view.select({ testId: 'filter-status' }, 'all')
  assert.equal(view.valueOf({ testId: 'edit-title-2' }), 'half done')
  done(view)
  await view.unmount()
})

const answers = (input: { displayName: string }) =>
  input.displayName === 'other' ? { repo: 'otherrepo', repos: ['otherrepo', 'proj', 'zed'] } : { repo: 'proj', repos: ['proj', 'zed'] }

test("a picked repo is dropped when the focused worktree changes: new tasks get the new worktree's repo", async () => {
  const h = mockHost({ results: { 'workspace.readContext': { ...wt, terminals: [] } }, requests: { repoContext: answers } })
  const view = await mount(panel, { host: h })
  await view.press({ testId: 'more-toggle' })
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
  await view.press({ testId: 'more-toggle' })
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
  await view.press({ testId: 'more-toggle' })
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
  await view.press({ testId: 'more-toggle' })
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
  await view.press({ testId: 'more-toggle' })
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
  await view.press({ testId: 'more-toggle' })
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'x')
  await view.type({ type: 'Textarea', label: 'รายละเอียด' }, '<script>y</script>')
  await view.press({ text: 'เพิ่ม' })
  assert.ok(view.find({ text: '<script>y</script>' }))
  done(view)
  await view.unmount()
})

test('the extra fields stay hidden until รายละเอียดเพิ่มเติม is pressed', async () => {
  const view = await mount(panel, { host: host() })
  assert.equal(view.find({ type: 'Textarea', label: 'รายละเอียด' }), null)
  assert.equal(view.find({ type: 'Input', label: 'วันครบกำหนด' }), null)
  await view.press({ testId: 'more-toggle' })
  assert.ok(view.find({ type: 'Textarea', label: 'รายละเอียด' }))
  assert.ok(view.find({ type: 'Input', label: 'วันครบกำหนด' }))
  done(view)
  await view.unmount()
})

test('quick add with only a title stores empty description and due, status todo, default repo', async () => {
  const view = await mount(panel, { host: host() })
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'quick', { submit: true })
  const [t] = stored(view)
  assert.deepEqual([t.description, t.dueDate, t.status, t.repo], ['', '', 'todo', 'proj'])
  done(view)
  await view.unmount()
})

test('a due date typed into the extra fields and then collapsed is ignored by quick add, even an invalid one', async () => {
  const view = await mount(panel, { host: host() })
  await view.press({ testId: 'more-toggle' })
  await view.type({ type: 'Input', label: 'วันครบกำหนด' }, '2026-02-30')
  await view.press({ testId: 'more-toggle' })
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'x', { submit: true })
  assert.equal(stored(view)[0].dueDate, '')
  assert.equal(JSON.stringify(view.tree()).includes('วันที่ต้องเป็น YYYY-MM-DD'), false)
  done(view)
  await view.unmount()
})

test('due badges say overdue, today, or the plain date once completed', async () => {
  const due = (id: string, status: string, dueDate: string) => ({ ...task(id, id, status), dueDate })
  const view = await mount(panel, { host: host([due('late', 'todo', '2000-01-01'), due('now', 'todo', todayLocal()), due('fin', 'completed', '2000-01-02')]) })
  const tree = JSON.stringify(view.tree())
  assert.equal(tree.includes('เลยกำหนด'), true)
  assert.equal(tree.includes('ครบวันนี้'), true)
  assert.equal(tree.includes('2000-01-02'), true)
  // The completed task past its date must not add an overdue badge: one overdue per one due-today.
  assert.equal(tree.split('เลยกำหนด').length, tree.split('ครบวันนี้').length)
  done(view)
  await view.unmount()
})

test('the no-repo filter keeps only tasks without a repo and survives re-rendering', async () => {
  const list = [task('1', 'a', 'todo', wt, 'proj'), task('2', 'b', 'todo', wt, '')]
  const view = await mount(panel, { host: host(list) })
  await view.select({ testId: 'filter-repo' }, NO_REPO)
  const has = (l: string) => view.find({ type: 'Checkbox', label: l }) !== null
  assert.deepEqual(['a', 'b'].filter(has), ['b'])
  await view.select({ testId: 'filter-status' }, 'todo')
  assert.deepEqual(['a', 'b'].filter(has), ['b'])
  assert.equal(JSON.stringify(view.tree()).includes('ไม่ระบุ repo'), true)
  done(view)
  await view.unmount()
})

test('rows are ordered by due date, unfinished first', async () => {
  const due = (id: string, dueDate: string, status = 'todo') => ({ ...task(id, id, status), dueDate })
  const view = await mount(panel, { host: host([due('later', '2999-02-01'), due('fin', '2999-01-01', 'completed'), due('earlier', '2999-01-15')]) })
  const tree = JSON.stringify(view.tree())
  const at = (l: string) => tree.indexOf(`"${l}"`)
  assert.equal(at('earlier') < at('later') && at('later') < at('fin'), true)
  done(view)
  await view.unmount()
})

test('extra fields typed and then collapsed are not applied to a quick add', async () => {
  const view = await mount(panel, { host: host() })
  await view.press({ testId: 'more-toggle' })
  await view.type({ type: 'Textarea', label: 'รายละเอียด' }, 'hidden')
  await view.type({ type: 'Input', label: 'วันครบกำหนด' }, '2999-01-01')
  await view.select({ type: 'Select', label: 'repo' }, 'zed')
  await view.select({ type: 'Select', label: 'สถานะ' }, 'in-review')
  await view.press({ testId: 'more-toggle' })
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'quick', { submit: true })
  const t = stored(view)[0]
  assert.deepEqual([t.description, t.dueDate, t.status, t.repo], ['', '', 'todo', 'proj'])
  done(view)
  await view.unmount()
})

test('after Add the picked repo and status go back to the defaults', async () => {
  const view = await mount(panel, { host: host() })
  await view.press({ testId: 'more-toggle' })
  await view.select({ type: 'Select', label: 'repo' }, 'zed')
  await view.select({ type: 'Select', label: 'สถานะ' }, 'in-review')
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'one', { submit: true })
  await view.type({ type: 'Input', label: 'งานใหม่' }, 'two', { submit: true })
  const [a, b] = stored(view)
  assert.deepEqual([a.repo, a.status], ['zed', 'in-review'])
  assert.deepEqual([b.repo, b.status], ['proj', 'todo'])
  done(view)
  await view.unmount()
})

test('the footer names the active filters and says nothing when there are none', async () => {
  const view = await mount(panel, { host: host([task('1', 'a', 'todo', wt, 'zed')]) })
  assert.equal(JSON.stringify(view.tree()).includes('กรอง:'), false)
  await view.select({ testId: 'filter-status' }, 'todo')
  await view.select({ testId: 'filter-repo' }, 'zed')
  assert.ok(view.find({ text: 'กรอง: todo, zed' }))
  await view.select({ testId: 'filter-repo' }, NO_REPO)
  assert.ok(view.find({ text: 'กรอง: todo, ไม่ระบุ repo' }))
  await view.select({ testId: 'filter-status' }, 'all')
  assert.ok(view.find({ text: 'กรอง: ไม่ระบุ repo' }))
  assert.ok(view.find({ text: 'เหลือ 0 งาน' }))
  done(view)
  await view.unmount()
})
