// No build step: Orca strips the types and compiles the JSX when the panel loads.
import {
  atom,
  Button,
  EmptyState,
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
  update,
  type PanelContext
} from 'orca'
import {
  addTask,
  clearCompleted,
  forWorktree,
  parseTasks,
  removeTask,
  repoOptions,
  setRepo,
  setStatus,
  STATUSES,
  type Status,
  type Task,
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

const NONE: Worktree = { displayName: '', branch: '' }
const pick = (c: Worktree | null): Worktree | null => (c ? { displayName: c.displayName, branch: c.branch } : null)

function refresh(context: Worktree | null): void {
  const wt = pick(context)
  set(focused, wt)
  // Never rejects into the panel: a failed request keeps what it had.
  plugin
    .request('repoContext', wt ?? NONE)
    .then((answer) => set(repoInfo, { repo: wt ? answer.repo : '', repos: answer.repos }))
    .catch(() => {})
}

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(on('workspace.changed', ({ context }) => refresh(context)))
  host.call('workspace.readContext').then(refresh, () => {})
}

// Edits start from parseTasks(stored) and run only on a user action; render never writes.
const edit = (f: (list: Task[]) => Task[]) => update(tasks, (stored) => f(parseTasks(stored)))

function submit(text: string): void {
  if (!text.trim()) return
  const wt = read(focused) ?? NONE
  const repo = read(draftRepo) ?? read(repoInfo).repo
  edit((list) => addTask(list, { text, repo, worktree: wt }, Date.now(), () => `${Date.now()}-${Math.random().toString(36).slice(2)}`))
  set(draft, '')
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

function Rows({ list, options, select }: { list: Task[]; options: string[]; select: boolean }) {
  if (list.length === 0) return <EmptyState title="ยังไม่มีงาน" description="พิมพ์งานด้านบนแล้วกด Enter" icon="check" />
  return (
    <List label="งาน">
      {list.map((t) => (
        <ListItem key={t.id}>
          <Text>{t.text}</Text>
          <Row gap="sm" align="center" justify="between">
            {repoField(`repo-${t.id}`, t.repo, options, (v) => edit((l) => setRepo(l, t.id, v)), select)}
            <Select
              key={`status-${t.id}`}
              label="สถานะ"
              labelHidden
              value={t.status}
              options={STATUSES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => edit((l) => setStatus(l, t.id, v as Status))}
            />
            <IconButton key={`delete-${t.id}`} icon="delete" label="ลบ" onPress={() => edit((l) => removeTask(l, t.id))} />
          </Row>
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
  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Input label="งานใหม่" labelHidden placeholder="งานใหม่" value={read(draft)} onChange={(v) => set(draft, v)} onSubmit={submit} />
        <Row gap="xs" align="center">
          {repoField(undefined, chosen, options, (v) => set(draftRepo, v), repos.length > 0)}
          <Button onPress={() => submit(read(draft))}>เพิ่ม</Button>
        </Row>
      </Stack>
      <Tabs label="มุมมอง" value={read(tab)} onChange={(v) => set(tab, v)}>
        <Tab value="all" label="ทั้งหมด">
          <Rows list={list} options={options} select={repos.length > 0} />
        </Tab>
        <Tab value="worktree" label="worktree นี้">
          <Rows list={forWorktree(list, wt ?? NONE)} options={options} select={repos.length > 0} />
        </Tab>
      </Tabs>
      <Button variant="ghost" onPress={() => edit(clearCompleted)}>
        ล้างที่เสร็จแล้ว
      </Button>
    </Stack>
  )
}
