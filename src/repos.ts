import type { Worktree } from './tasks'

export function repoFromPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop() ?? ''
}

export function repoContextFrom(
  workspaces: { name: string; path: string; branch: string | null }[],
  ctx: Worktree,
): { repo: string; repos: string[] } {
  const hit = workspaces.find((w) => w.name === ctx.displayName && w.branch === ctx.branch)
  const repos = [...new Set(workspaces.map((w) => repoFromPath(w.path)).filter(Boolean))].sort()
  return { repo: hit ? repoFromPath(hit.path) : '', repos }
}
