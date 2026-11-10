import type { Worktree } from './tasks'

export function repoFromPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop() ?? ''
}

export function repoContextFrom(
  workspaces: { name: string; path: string; branch: string | null }[],
  ctx: Worktree,
): { repo: string; repos: string[] } {
  // Same worktree name and branch in two repos is ambiguous: answer '' and let the user pick.
  const hits = [...new Set(workspaces.filter((w) => w.name === ctx.displayName && w.branch === ctx.branch).map((w) => repoFromPath(w.path)))]
  const repos = [...new Set(workspaces.map((w) => repoFromPath(w.path)).filter(Boolean))].sort()
  return { repo: hits.length === 1 ? hits[0] : '', repos }
}
