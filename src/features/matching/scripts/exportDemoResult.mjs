import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const count = process.argv[2] === undefined ? 5 : Number(process.argv[2])
const server = await createServer({
  root: fileURLToPath(new URL('../../../../', import.meta.url)),
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'silent',
})
try {
  const { createDemoAssessmentInput, groupAssessmentResults } = await server.ssrLoadModule('/src/features/matching/services/assessmentMatching.js')
  const result = groupAssessmentResults(createDemoAssessmentInput(count))
  const directory = new URL('../examples/', import.meta.url)
  await mkdir(directory, { recursive: true })
  const target = new URL(`matching-${count}.json`, directory)
  await writeFile(target, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify({ file: fileURLToPath(target), status: result.status, groups: result.groups.map(({ members }) => members.map(({ displayName }) => displayName)) })}\n`)
} finally {
  await server.close()
}
