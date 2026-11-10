// Runs src/worker.ts's activate(orca) with the orca object Orca passes, over a mock host.
import { assert, hostError, mockHost, mountWorker, test } from 'orca/testing'
import * as main from './worker'

const list = { workspaces: [{ id: '1', kind: 'worktree', name: 'wt', path: 'D:\\r\\proj\\', branch: 'main', hostId: null }], truncated: false }

test('repoContext resolves the repo from workspace.list', async () => {
  const host = mockHost({ capabilities: ['workspace:read'], results: { 'workspace.list': list } })
  const worker = await mountWorker(main, { host })
  assert.deepEqual(await worker.request('repoContext', { displayName: 'wt', branch: 'main' }), { repo: 'proj', repos: ['proj'] })
  await worker.deactivate()
})

test('repoContext never throws when workspace.list fails', async () => {
  const host = mockHost({ results: { 'workspace.list': () => { throw hostError('unavailable', 'down') } } })
  const worker = await mountWorker(main, { host })
  assert.deepEqual(await worker.request('repoContext', { displayName: 'wt', branch: 'main' }), { repo: '', repos: [] })
  await worker.deactivate()
})
