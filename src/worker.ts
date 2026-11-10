// The plugin's own worker: answers the panel's repoContext request. Orca starts it on the
// panel's first plugin.request and transpiles this file when it loads: no build step.
import type { OrcaWorkerApi } from 'orca/worker'
import { repoContextFrom } from './repos'

export default function activate(orca: OrcaWorkerApi): void {
  // Never throws: a failed or truncated workspace.list still answers with what it has.
  orca.panels.handle('repoContext', async (ctx) => {
    try {
      const { workspaces } = await orca.host.call('workspace.list')
      return repoContextFrom(workspaces, ctx)
    } catch {
      return { repo: '', repos: [] }
    }
  })
}
