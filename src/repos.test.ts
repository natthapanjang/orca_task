import { assert, test } from 'orca/testing'
import { repoContextFrom, repoFromPath } from './repos'

const ws = (name: string, path: string, branch: string | null) => ({ name, path, branch })

test('repoFromPath handles windows and posix paths', () => {
  assert.equal(repoFromPath('D:/0_It-cats/humanos-irpc'), 'humanos-irpc')
  assert.equal(repoFromPath('D:\\0_It-cats\\humanos-irpc\\'), 'humanos-irpc')
  assert.equal(repoFromPath(''), '')
})

test('repoContextFrom picks the matching workspace', () => {
  const list = [ws('a', '/r/alpha', 'main'), ws('b', '/r/beta', 'feat')]
  assert.deepEqual(repoContextFrom(list, { displayName: 'b', branch: 'feat' }), { repo: 'beta', repos: ['alpha', 'beta'] })
})

test('repoContextFrom returns empty repo when nothing matches or list is empty', () => {
  assert.deepEqual(repoContextFrom([], { displayName: 'a', branch: 'main' }), { repo: '', repos: [] })
  assert.equal(repoContextFrom([ws('a', '/r/alpha', 'main')], { displayName: 'x', branch: 'y' }).repo, '')
})

test('repoContextFrom lists distinct sorted repos', () => {
  const list = [ws('1', '/r/zeta', null), ws('2', 'C:\\r\\alpha', 'm'), ws('3', '/x/zeta', 'm')]
  assert.deepEqual(repoContextFrom(list, { displayName: 'none', branch: '' }).repos, ['alpha', 'zeta'])
})
