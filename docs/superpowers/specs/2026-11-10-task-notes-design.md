# task-notes: Orca plugin for jotting tasks by hand

## Goal
A panel inside Orca where the user types tasks, picks a repo and a status, ticks progress and deletes.
No Jira, GitHub, Linear or MCP. Data stays on this machine, in a plain JSON file an AI agent can read.

Success: open the panel in a worktree, add a task (repo already filled from that worktree, status `todo`),
change its status, restart Orca, the task is still there, and `storage.json` shows it.

## Scope
In:
- Add (button or Enter), edit status, change repo, delete, clear `completed`.
- Fields per task: `text`, `status`, `repo`, `worktree`.
- Two tabs: **ทั้งหมด** (every task) and **worktree นี้** (tasks of the focused worktree).
- Status values match Orca's board: `todo`, `in-progress`, `in-review`, `completed`.
- Repo is a dropdown. Default = repo of the focused worktree (see Repo default).

Out (not supported by the plugin API we found, or not verified):
- Setting the kanban card status of a worktree (CLI only: `orca worktree set --workspace-status`).
- Sending a task to an agent (a worker may be able to open a terminal with a command; not verified).

## Approach
`orca plugin create <dir> --template worker-panel`: TSX panel plus a TypeScript worker.
The worker is needed because `workspace.list` (id, name, path, branch) is a worker-only host method.
Loading it needs `--approve` from the user.

## Data
One storage key `tasks` in the plugin's private store (`storage.get` / `storage.set`).
File on disk: `%APPDATA%\orca\plugins-data\<plugin-id>\storage.json`, so an agent can read it directly.

```
{ id: string, text: string, status: 'todo'|'in-progress'|'in-review'|'completed',
  repo: string, worktree: { displayName: string, branch: string }, at: number }[]
```

"worktree นี้" filters on `worktree.displayName` + `branch` equal to the focused workspace
(`workspace.readContext`).

## Repo default
The repo is the name of the focused worktree's repo folder, taken from its `path` in `workspace.list`
(for example `D:/0_It-cats/humanos-irpc` gives `humanos-irpc`). The dropdown lists the distinct repo names found in
`workspace.list` plus any typed in by hand. Changing the repo on a task is allowed and never alters the default.
Linked worktrees may live under a different path pattern, so the derived name can be wrong there;
the user fixes it in the dropdown. The "worktree นี้" tab also shows the repo indirectly.

## Errors
- Empty or whitespace-only text is ignored.
- Text is stored as plain text and rendered as text, never as markup.
- If `workspace.list` fails or returns nothing, repo defaults to empty and the user picks one.
- Writes go through one function that reads, updates and writes `tasks`, to avoid losing edits.

## Testing
1. `orca plugin validate <dir>`, `orca plugin check <dir>`, `orca plugin test <dir>` (worker tests).
2. Manual in the app: add in two different worktrees, confirm "worktree นี้" separates them and "ทั้งหมด" shows both,
   change status and repo, restart Orca, open `storage.json` and confirm the content.

## Open points to verify while building
- Component names Orca exposes for input, select, tabs and list (`orca-components*.d.ts`).
- Whether a panel can get `workspace.list` through `plugin.request` to its worker.
- Real `path` pattern of linked worktrees, to judge how often the derived repo name is wrong.
- Install: `orca plugin install <dir> --approve`, run by the user.

## Where the code lives
Create the plugin folder in a real folder the user picks; this session's working folder is deleted with the session.
