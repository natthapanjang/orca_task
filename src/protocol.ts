// The panel <-> worker contract, declared once: src/panel.tsx and src/worker.ts both read it.
import type { Worktree } from './tasks'

declare module 'orca' {
  interface PluginRequests {
    /** The total the worker keeps in storage. */
    'counter.get': { output: { total: number } }
    /** Adds `by` to the stored total and answers the new total. */
    'counter.add': { input: { by: number }; output: { total: number } }
    /** The repo of the given worktree and every repo Orca knows; empty when workspace.list fails. */
    repoContext: { input: Worktree; output: { repo: string; repos: string[] } }
  }
  interface PluginPanelEvents {
    /** Posted to every open panel after the total changes. */
    'counter.changed': { total: number }
  }
}
