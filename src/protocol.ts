// The panel <-> worker contract, declared once: src/panel.tsx and src/worker.ts both read it.
import type { Worktree } from './tasks'

declare module 'orca' {
  interface PluginRequests {
    /** The repo of the given worktree and every repo Orca knows; empty when workspace.list fails. */
    repoContext: { input: Worktree; output: { repo: string; repos: string[] } }
  }
}
