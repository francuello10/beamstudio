import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const checks = []

function addCheck(name, pass, detail) {
  checks.push({ name, pass, detail })
}

function checkExists(relativePath) {
  const absolutePath = path.join(root, relativePath)
  addCheck(
    `file:${relativePath}`,
    existsSync(absolutePath),
    existsSync(absolutePath) ? 'present' : 'missing'
  )
}

function checkPattern(relativePath, pattern, shouldExist, label) {
  const absolutePath = path.join(root, relativePath)
  if (!existsSync(absolutePath)) {
    addCheck(label, false, `${relativePath} missing`)
    return
  }

  const content = readFileSync(absolutePath, 'utf8')
  const found = pattern.test(content)
  addCheck(
    label,
    shouldExist ? found : !found,
    found ? 'pattern found' : 'pattern not found'
  )
}

checkExists('package.json')
checkExists('scripts/check.mjs')
checkExists('scripts/doctor.mjs')
checkExists('src/preload/index.js')
checkExists('src/main/index.js')

checkPattern(
  'src/preload/index.js',
  /removeAllListeners\s*\(/,
  false,
  'preload:no-removeAllListeners'
)

checkPattern(
  'src/preload/index.js',
  /removeListener\s*\(/,
  true,
  'preload:uses-removeListener-cleanup'
)

checkPattern(
  'src/main/index.js',
  /process\.on\('uncaughtException'/,
  true,
  'main:uncaughtException-hook'
)

checkPattern(
  'src/main/index.js',
  /process\.on\('unhandledRejection'/,
  true,
  'main:unhandledRejection-hook'
)

const failed = checks.filter(check => !check.pass)

for (const check of checks) {
  const status = check.pass ? 'PASS' : 'FAIL'
  console.log(`${status} ${check.name} :: ${check.detail}`)
}

if (failed.length > 0) {
  console.error(`\ncheck failed: ${failed.length} issue(s)`)
  process.exit(1)
}

console.log(`\ncheck passed: ${checks.length} checks`)
