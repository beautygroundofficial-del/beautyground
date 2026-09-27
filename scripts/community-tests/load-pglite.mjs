import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Resolve from an external npm --prefix directory without changing this project's dependencies.
export async function loadPGlite() {
  try {
    const prefix = process.env.COMMUNITY_TEST_RUNTIME
    const module = prefix
      ? await import(pathToFileURL(createRequire(pathToFileURL(path.join(path.resolve(prefix), 'package.json')))
        .resolve('@electric-sql/pglite')).href)
      : await import('@electric-sql/pglite')
    const PGlite = module.PGlite ?? module.default?.PGlite
    if (typeof PGlite !== 'function') throw new Error('PGlite export was not found')
    return PGlite
  } catch (cause) {
    throw new Error('PGlite를 불러오지 못했습니다. scripts/community-tests/README.md를 따라 외부 npm 설치 경로를 COMMUNITY_TEST_RUNTIME에 지정하세요.', { cause })
  }
}
