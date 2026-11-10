// No build step: Orca strips the types and compiles the JSX when the panel loads.
import {
  atom,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Field,
  host,
  IconButton,
  Input,
  List,
  ListItem,
  on,
  plugin,
  read,
  Row,
  Select,
  set,
  Stack,
  Tab,
  Tabs,
  Text,
  Textarea,
  update,
  type PanelContext
} from 'orca'
import {
  addTask,
  dueBadge,
  filterTasks,
  forWorktree,
  NO_REPO,
  parseTasks,
  removeTask,
  repoOptions,
  setStatus,
  sortTasks,
  STATUSES,
  type Status,
  type Task,
  todayLocal,
  updateTask,
  validDue,
  type Worktree
} from './tasks'

const tasks = atom<Task[]>('tasks', [], { persist: 'storage' })
/** The focused workspace; null when none is focused. */
const focused = atom<Worktree | null>(null)
const repoInfo = atom<{ repo: string; repos: string[] }>({ repo: '', repos: [] })
const draft = atom('')
/** The repo picked or typed for the next task; null means the focused worktree's repo. */
const draftRepo = atom<string | null>(null)
const tab = atom('all')
const draftStatus = atom<Status>('todo')
const draftDesc = atom('')
const draftDue = atom('')
/** Whether the add form's extra fields (description, due, repo, status) are shown. */
const more = atom(false)
/** True after Add with a due date that is not a real YYYY-MM-DD; cleared by typing. */
const dueError = atom(false)
/** List filters; 'all' means no filter. */
const filterStatus = atom<string>('all')
const filterRepo = atom<string>('all')
/** True after Add with blank text; cleared by typing. */
const blankError = atom(false)
/** The task shown as an edit form (one at a time) and that form's fields. Not persisted: Cancel and reload drop it. */
const editing = atom<string | null>(null)
const eTitle = atom('')
const eDesc = atom('')
const eDue = atom('')
const eRepo = atom('')
const eStatus = atom<Status>('todo')
const eTitleError = atom(false)
const eDueError = atom(false)

const NONE: Worktree = { displayName: '', branch: '' }
const pick = (c: Worktree | null): Worktree | null => (c ? { displayName: c.displayName, branch: c.branch } : null)

const same = (a: Worktree | null, b: Worktree | null) => a?.displayName === b?.displayName && a?.branch === b?.branch

function refresh(context: Worktree | null): void {
  const wt = pick(context)
  // workspace.changed also fires for terminal changes: only a different worktree drops the user's repo pick.
  if (!same(read(focused), wt)) set(draftRepo, null)
  set(focused, wt)
  // Never rejects into the panel: a failed request keeps what it had.
  plugin
    .request('repoContext', wt ?? NONE)
    // Answers can arrive out of order: only the one for the still-focused worktree counts.
    .then((answer) => same(read(focused), wt) && set(repoInfo, { repo: wt ? answer.repo : '', repos: answer.repos }))
    .catch(() => {})
}

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(on('workspace.changed', ({ context }) => refresh(context)))
  host.call('workspace.readContext').then(refresh, () => {})
}

// Edits start from parseTasks(stored) and run only on a user action; render never writes.
const edit = (f: (list: Task[]) => Task[]) => update(tasks, (stored) => f(parseTasks(stored)))

function submit(text: string): void {
  if (!text.trim()) return void set(blankError, true)
  const wt = read(focused) ?? NONE
  // Collapsed means quick add: hidden leftovers in the extra fields must not leak into the task.
  const open = read(more)
  const repo = (open && read(draftRepo)) || read(repoInfo).repo
  const status = open ? read(draftStatus) : 'todo'
  const dueDate = open ? read(draftDue).trim() : ''
  if (!validDue(dueDate)) return void set(dueError, true)
  const description = open ? read(draftDesc) : ''
  edit((list) => addTask(list, { title: text, description, dueDate, repo, worktree: wt, status }, Date.now(), () => `${Date.now()}-${Math.random().toString(36).slice(2)}`))
  set(draft, '')
  set(draftDesc, '')
  set(draftDue, '')
  // The next task starts from the defaults again: the focused worktree's repo, status todo.
  set(draftRepo, null)
  set(draftStatus, 'todo')
  set(blankError, false)
  set(dueError, false)
}

const statusOptions = STATUSES.map((s) => ({ value: s, label: s }))
const filterStatusOptions = [{ value: 'all', label: 'ทั้งหมด' }, ...statusOptions]

// Select takes no free text, so with no known repo a typed Input stands in.
// select = Orca knows repos: typing a repo adds it to the options, which must not swap the Input for a Select mid-typing.
// Called as a function, not a tag, so the key lands on the Select/Input itself.
function repoField(id: string | undefined, value: string, options: string[], onChange: (v: string) => void, select: boolean) {
  return select ? (
    <Select key={id} label="repo" labelHidden placeholder="repo" value={value} options={options.map((r) => ({ value: r, label: r }))} onChange={onChange} />
  ) : (
    <Input key={id} label="repo" labelHidden placeholder="repo" value={value} onChange={onChange} />
  )
}

function startEdit(t: Task): void {
  set(editing, t.id)
  set(eTitle, t.title)
  set(eDesc, t.description)
  set(eDue, t.dueDate)
  set(eRepo, t.repo)
  set(eStatus, t.status)
  set(eTitleError, false)
  set(eDueError, false)
}

// Checks the draft first so a bad field keeps the form open with its error beside it; updateTask would refuse the same inputs silently.
function saveEdit(id: string): void {
  const title = read(eTitle)
  const dueDate = read(eDue).trim()
  const badTitle = !title.trim()
  const badDue = !validDue(dueDate)
  set(eTitleError, badTitle)
  set(eDueError, badDue)
  if (badTitle || badDue) return
  edit((l) => updateTask(l, id, { title, description: read(eDesc), dueDate, repo: read(eRepo), status: read(eStatus) }))
  set(editing, null)
}

function EditForm({ id, options, select }: { id: string; options: string[]; select: boolean }) {
  return (
    <Stack gap="xs">
      <Field label="ชื่องาน" required error={read(eTitleError) ? 'พิมพ์ข้อความงานก่อน' : undefined}>
        <Input
          key={`edit-title-${id}`}
          label="ชื่องาน"
          labelHidden
          value={read(eTitle)}
          invalid={read(eTitleError)}
          onChange={(v) => (set(eTitle, v), set(eTitleError, false))}
          onSubmit={() => saveEdit(id)}
        />
      </Field>
      <Field label="รายละเอียด">
        <Textarea key={`edit-desc-${id}`} label="รายละเอียด" labelHidden rows={2} value={read(eDesc)} onChange={(v) => set(eDesc, v)} />
      </Field>
      <Field label="วันครบกำหนด" error={read(eDueError) ? 'วันที่ต้องเป็น YYYY-MM-DD' : undefined}>
        <Input
          key={`edit-due-${id}`}
          label="วันครบกำหนด"
          labelHidden
          placeholder="YYYY-MM-DD"
          value={read(eDue)}
          invalid={read(eDueError)}
          onChange={(v) => (set(eDue, v), set(eDueError, false))}
          onSubmit={() => saveEdit(id)}
        />
      </Field>
      <Field label="repo">{repoField(`edit-repo-${id}`, read(eRepo), options, (v) => set(eRepo, v), select)}</Field>
      <Field label="สถานะ">
        <Select key={`edit-status-${id}`} label="สถานะ" labelHidden value={read(eStatus)} options={statusOptions} onChange={(v) => set(eStatus, v as Status)} />
      </Field>
      <Row gap="xs" align="center">
        <Button key={`save-${id}`} onPress={() => saveEdit(id)}>
          บันทึก
        </Button>
        <Button key={`cancel-${id}`} variant="ghost" onPress={() => set(editing, null)}>
          ยกเลิก
        </Button>
      </Row>
    </Stack>
  )
}

function Rows({ list, options, select, empty, filtered }: { list: Task[]; options: string[]; select: boolean; empty: string; filtered: boolean }) {
  if (list.length === 0)
    return filtered ? (
      <EmptyState title="ไม่มีงานตรงตัวกรอง" description="เปลี่ยนตัวกรองด้านบนเป็น “ทั้งหมด”" icon="check" />
    ) : (
      <EmptyState title="ยังไม่มีงาน" description={empty} icon="check" />
    )
  return (
    <List label="งาน">
      {list.map((t) => {
        const due = dueBadge(t, todayLocal())
        if (read(editing) === t.id)
          return (
            <ListItem key={t.id}>
              <EditForm id={t.id} options={options} select={select} />
            </ListItem>
          )
        return (
        <ListItem key={t.id}>
          <Stack gap="xs">
            <Checkbox
              key={`done-${t.id}`}
              label={t.title}
              checked={t.status === 'completed'}
              onChange={(on) => edit((l) => setStatus(l, t.id, on ? 'completed' : 'todo'))}
            />
            {t.description ? (
              <Text muted size="xs">
                {t.description}
              </Text>
            ) : null}
            <Row gap="xs" align="center" justify="between" wrap>
              <Row gap="xs" align="center">
                <Badge tone={t.repo ? 'neutral' : 'warning'}>{t.repo || 'ไม่ระบุ repo'}</Badge>
                {due ? <Badge tone={due.tone}>{due.text}</Badge> : null}
              </Row>
              <Row gap="xs" align="center">
                <Select
                  key={`status-${t.id}`}
                  label="สถานะ"
                  labelHidden
                  value={t.status}
                  options={statusOptions}
                  onChange={(v) => edit((l) => setStatus(l, t.id, v as Status))}
                />
                <IconButton key={`edit-${t.id}`} icon="edit" label={`แก้ไข: ${t.title}`} variant="ghost" size="xs" onPress={() => startEdit(t)} />
                <IconButton key={`delete-${t.id}`} icon="delete" label={`ลบ: ${t.title}`} tone="danger" variant="ghost" onPress={() => edit((l) => removeTask(l, t.id))} />
              </Row>
            </Row>
          </Stack>
        </ListItem>
        )
      })}
    </List>
  )
}

export default function Panel() {
  const list = parseTasks(read(tasks))
  const wt = read(focused)
  const { repo, repos } = read(repoInfo)
  const options = repoOptions(list, repos)
  const chosen = read(draftRepo) ?? repo
  const select = repos.length > 0
  const mine = forWorktree(list, wt ?? NONE)
  const fs = read(filterStatus)
  // A repo that no longer appears anywhere (deleted or re-assigned) must not leave the list silently empty.
  const fr = read(filterRepo) === NO_REPO || options.includes(read(filterRepo)) ? read(filterRepo) : 'all'
  const filter = { status: (fs === 'all' ? '' : fs) as Status | '', repo: fr === 'all' ? '' : fr }
  const visible = filterTasks(read(tab) === 'worktree' ? mine : list, filter)
  const shown = (l: Task[]) => sortTasks(filterTasks(l, filter))
  const activeFilters = [fs === 'all' ? '' : fs, fr === 'all' ? '' : fr === NO_REPO ? 'ไม่ระบุ repo' : fr].filter(Boolean).join(', ')
  const remaining = visible.filter((t) => t.status !== 'completed').length
  const finished = visible.length - remaining
  const clearVisible = () => {
    const ids = new Set(visible.filter((t) => t.status === 'completed').map((t) => t.id))
    edit((l) => l.filter((t) => !ids.has(t.id)))
  }
  return (
    <Stack gap="md">
      <Row gap="xs" align="center" wrap>
        <Select key="filter-status" label="กรองสถานะ" labelHidden value={fs} options={filterStatusOptions} onChange={(v) => set(filterStatus, v)} />
        <Select
          key="filter-repo"
          label="กรองตามที่เก็บ"
          labelHidden
          value={fr}
          options={[{ value: 'all', label: 'ทุก repo' }, { value: NO_REPO, label: 'ไม่ระบุ repo' }, ...options.map((r) => ({ value: r, label: r }))]}
          onChange={(v) => set(filterRepo, v)}
        />
      </Row>
      <Stack gap="xs">
        <Field label="งานใหม่" required error={read(blankError) ? 'พิมพ์ข้อความงานก่อน' : undefined}>
          <Input
            label="งานใหม่"
            labelHidden
            placeholder="พิมพ์งาน แล้วกด Enter"
            value={read(draft)}
            invalid={read(blankError)}
            onChange={(v) => (set(draft, v), set(blankError, false))}
            onSubmit={submit}
          />
        </Field>
        <Button key="more-toggle" variant="ghost" icon={read(more) ? 'collapse' : 'expand'} onPress={() => set(more, !read(more))}>
          รายละเอียดเพิ่มเติม
        </Button>
        {read(more) ? (
          <Stack gap="xs">
          <Field label="รายละเอียด">
            <Textarea label="รายละเอียด" labelHidden rows={2} value={read(draftDesc)} onChange={(v) => set(draftDesc, v)} />
          </Field>
          <Field label="วันครบกำหนด" error={read(dueError) ? 'วันที่ต้องเป็น YYYY-MM-DD' : undefined}>
            <Input
              label="วันครบกำหนด"
              labelHidden
              placeholder="YYYY-MM-DD"
              value={read(draftDue)}
              invalid={read(dueError)}
              onChange={(v) => (set(draftDue, v), set(dueError, false))}
              onSubmit={() => submit(read(draft))}
            />
          </Field>
          <Field label="repo" description={select ? undefined : 'ไม่รู้ repo ของ worktree นี้ — พิมพ์เอง'}>
            {repoField(undefined, chosen, options, (v) => set(draftRepo, v), select)}
          </Field>
          <Field label="สถานะ">
            <Select label="สถานะ" labelHidden value={read(draftStatus)} options={statusOptions} onChange={(v) => set(draftStatus, v as Status)} />
          </Field>
          </Stack>
        ) : null}
        <Button icon="add" onPress={() => submit(read(draft))}>
          เพิ่ม
        </Button>
      </Stack>
      <Tabs label="มุมมอง" value={read(tab)} onChange={(v) => set(tab, v)}>
        <Tab value="all" label="ทั้งหมด">
          <Rows list={shown(list)} options={options} select={select} filtered={fs !== 'all' || fr !== 'all'} empty="พิมพ์งานด้านบนแล้วกด Enter" />
        </Tab>
        <Tab value="worktree" label="worktree นี้">
          <Rows list={shown(mine)} options={options} select={select} filtered={fs !== 'all' || fr !== 'all'} empty="worktree นี้ยังไม่มีงาน — สลับไป “ทั้งหมด” ดูของ worktree อื่น" />
        </Tab>
      </Tabs>
      <Row gap="sm" align="center" justify="between" wrap>
        <Stack gap="xs">
          <Text muted size="xs">
            เหลือ {remaining} งาน
          </Text>
          {activeFilters ? (
            <Text muted size="xs">
              {`กรอง: ${activeFilters}`}
            </Text>
          ) : null}
        </Stack>
        <Button variant="ghost" disabled={finished === 0} onPress={clearVisible}>
          ล้างที่เสร็จแล้ว
        </Button>
      </Row>
    </Stack>
  )
}
