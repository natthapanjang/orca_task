# Task notes

A right-sidebar panel for jotting tasks by hand. Each task has `title`, `description`, `dueDate` (`YYYY-MM-DD` or empty), `repo` and `status` (`todo`, `in-progress`, `in-review`, `completed`). The repo defaults to the focused worktree's repo. The list can be filtered by status and by repo, on top of the two tabs.

## AI access

Tasks are one `tasks` array in the plugin's own `storage.json` (`%APPDATA%\Orca\plugins-data\<publisher>.task-notes\storage.json`, e.g. `local.task-notes` when installed from a folder; find the folder with `dir "$env:APPDATA\Orca\plugins-data"`). An AI session reads that file; to see only one repo's open tasks:

```sh
node -e "const f=process.argv[1],r=process.argv[2];const t=JSON.parse(require('fs').readFileSync(f,'utf8')).tasks||[];console.log(JSON.stringify(t.filter(x=>x.repo===r&&x.status!=='completed'),null,1))" "<path to storage.json>" "<repo name>"
```

Tell the agent the file path and the repo name (for example in the repo's `CLAUDE.md`). Old items saved with `text` instead of `title` are read as titles. The `{ "tasks": [...] }` layout matches other plugins' real `storage.json` files, but this plugin's own file was not seen on disk: check it exists after `orca plugin install <dir> --approve`.

- `src/panel.tsx`: the panel. `src/tasks.ts`: pure task logic. `src/repos.ts`: repo name from a workspace path.
- `src/worker.ts` answers the `repoContext` request (`src/protocol.ts`) using the host method `workspace.list`, which needs the `workspace:read` capability.
- `orca plugin test .` runs the tests in Node with `orca/testing`; `orca plugin check .` renders the panel in each `src/panel.check.ts` scenario.

Known limit: "worktree นี้" matches tasks on worktree name and branch only, so two repos with a worktree of the same name and branch show each other's tasks, and the default repo is left empty for you to pick.

## Develop

```sh
orca plugin validate .
orca plugin dev watch .    # loads this folder into Orca and prints its logs and reloads; Ctrl-C unloads it
```

Orca names the publisher after where the plugin is installed from: the GitHub or GitLab owner of
its repository, or `local` for a folder. See
https://github.com/stablyai/orca/blob/main/docs/reference/plugin-authoring.md.
