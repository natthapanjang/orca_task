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
  filterTasks,
  forWorktree,
  parseTasks,
  removeTask,
  repoOptions,
  setRepo,
  setStatus,
  STATUSES,
  type Status,
  type Task,
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
/** True after Add with a due date that is not a real YYYY-MM-DD; cleared by typing. */
const dueError = atom(false)
/** List filters; 'all' means no filter. */
const filterStatus = atom<string>('all')
const filterRepo = atom<string>('all')
/** True after Add with blank text; cleared by typing. */
const blankError = atom(false)
/** The task whose repo is being changed (its Badge is a Select meanwhile). */
const editing = atom<string | null>(null)

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
  const repo = read(draftRepo) ?? read(repoInfo).repo
  const status = read(draftStatus)
  const dueDate = read(draftDue).trim()
  if (!validDue(dueDate)) return void set(dueError, true)
  const description = read(draftDesc)
  edit((list) => addTask(list, { title: text, description, dueDate, repo, worktree: wt, status }, Date.now(), () => `${Date.now()}-${Math.random().toString(36).slice(2)}`))
  set(draft, '')
  set(draftDesc, '')
  set(draftDue, '')
  set(blankError, false)
  set(dueError, false)
}

const statusOptions = STATUSES.map((s) => ({ value: s, label: s }))
const filterStatusOptions = [{ value: 'all', label: 'ทั้งหมด' }, ...statusOptions]
// Local calendar day as YYYY-MM-DD; string order equals date order.
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Select takes no free text, so with no known repo a typed Input stands in.
// select = Orca knows repos: typing a repo adds it to the options, which must not swap the Input for a Select mid-typing.
// Called as a function, not a tag, so the key lands on the Select/Input itself.
function repoField(id: string | undefined, value: string, options: string[], onChange: (v: string) => void, select: boolean) {
  return select ? (
    <Select key={id} label="repo" labelHidden placeholder="repo" value={value} options={options.map((r) => ({ value: r, label: r }))} onChange={onChange} />
  ) : (
    // A row (id set) commits on Enter only: a write per keystroke to the persisted atom lost keystrokes to its async echo.
    <Input key={id} label="repo" labelHidden placeholder={id ? "repo + Enter" : "repo"} {...(id ? { defaultValue: value, onSubmit: onChange } : { value, onChange })} />
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
      {list.map((t) => (
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
            {t.dueDate ? (
              <Badge tone={t.status !== 'completed' && t.dueDate < today() ? 'warning' : 'neutral'}>{t.dueDate}</Badge>
            ) : null}
            <Row gap="xs" align="center" justify="between" wrap>
              {read(editing) === t.id ? (
                repoField(`repo-${t.id}`, t.repo, options, (v) => (edit((l) => setRepo(l, t.id, v)), set(editing, null)), select)
              ) : (
                <Row gap="xs" align="center">
                  <Badge tone={t.repo ? 'neutral' : 'warning'}>{t.repo || 'ไม่ระบุ repo'}</Badge>
                  <IconButton key={`edit-${t.id}`} icon="edit" label={`เปลี่ยน repo: ${t.title}`} variant="ghost" size="xs" onPress={() => set(editing, t.id)} />
                </Row>
              )}
              <Row gap="xs" align="center">
                <Select
                  key={`status-${t.id}`}
                  label="สถานะ"
                  labelHidden
                  value={t.status}
                  options={statusOptions}
                  onChange={(v) => edit((l) => setStatus(l, t.id, v as Status))}
                />
                <IconButton key={`delete-${t.id}`} icon="delete" label={`ลบ: ${t.title}`} tone="danger" variant="ghost" onPress={() => edit((l) => removeTask(l, t.id))} />
              </Row>
            </Row>
          </Stack>
        </ListItem>
      ))}
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
  const fr = options.includes(read(filterRepo)) ? read(filterRepo) : 'all'
  const filter = { status: (fs === 'all' ? '' : fs) as Status | '', repo: fr === 'all' ? '' : fr }
  const visible = filterTasks(read(tab) === 'worktree' ? mine : list, filter)
  const shown = (l: Task[]) => filterTasks(l, filter)
  const remaining = visible.filter((t) => t.status !== 'completed').length
  const finished = visible.length - remaining
  const clearVisible = () => {
    const ids = new Set(visible.filter((t) => t.status === 'completed').map((t) => t.id))
    edit((l) => l.filter((t) => !ids.has(t.id)))
  }
  return (
    <Stack gap="md">
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
        <Button icon="add" onPress={() => submit(read(draft))}>
          เพิ่ม
        </Button>
      </Stack>
      <Row gap="xs" align="center" wrap>
        <Select key="filter-status" label="กรองสถานะ" labelHidden value={fs} options={filterStatusOptions} onChange={(v) => set(filterStatus, v)} />
        <Select
          key="filter-repo"
          label="กรองตามที่เก็บ"
          labelHidden
          value={fr}
          options={[{ value: 'all', label: 'ทุก repo' }, ...options.map((r) => ({ value: r, label: r }))]}
          onChange={(v) => set(filterRepo, v)}
        />
      </Row>
      <Tabs label="มุมมอง" value={read(tab)} onChange={(v) => set(tab, v)}>
        <Tab value="all" label="ทั้งหมด">
          <Rows list={shown(list)} options={options} select={select} filtered={fs !== 'all' || fr !== 'all'} empty="พิมพ์งานด้านบนแล้วกด Enter" />
        </Tab>
        <Tab value="worktree" label="worktree นี้">
          <Rows list={shown(mine)} options={options} select={select} filtered={fs !== 'all' || fr !== 'all'} empty="worktree นี้ยังไม่มีงาน — สลับไป “ทั้งหมด” ดูของ worktree อื่น" />
        </Tab>
      </Tabs>
      <Row gap="sm" align="center" justify="between" wrap>
        <Text muted size="xs">
          เหลือ {remaining} งาน
        </Text>
        <Button variant="ghost" disabled={finished === 0} onPress={clearVisible}>
          ล้างที่เสร็จแล้ว
        </Button>
      </Row>
    </Stack>
  )
}
