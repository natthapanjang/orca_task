# Task notes

A right-sidebar panel for jotting tasks by hand: each task has a status (`todo`, `in-progress`, `in-review`, `completed`) and a repo that defaults to the focused worktree's repo. Tasks are stored as one `tasks` array in the plugin's own `storage.json` (`%APPDATA%\orca\plugins-data\<plugin-id>\storage.json`), which an AI agent can read.

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
