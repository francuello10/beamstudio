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

checkPattern(
  'src/main/index.js',
  /\bCHANNEL_MAP\b/,
  false,
  'main:no-stale-CHANNEL_MAP'
)

checkPattern(
  'src/main/index.js',
  /\bdmxnet\b/,
  false,
  'main:no-artnet-runtime'
)

checkPattern(
  'src/renderer/src/pages/SystemPage.jsx',
  /Art-Net/,
  false,
  'renderer:no-artnet-toggle'
)

const audioAnalyzerPath = path.join(root, 'src/renderer/src/audio/AudioAnalyzer.js')
const audioAnalyzerContent = readFileSync(audioAnalyzerPath, 'utf8')
const spatialResponseMatch = audioAnalyzerContent.match(/export const buildSpatialResponse =[\s\S]*?\n}\)/)
const spatialResponseSource = spatialResponseMatch?.[0] || ''
addCheck(
  'audio:spatial-no-mono-vocal-injection',
  !!spatialResponseSource && !/vocalPulse/.test(spatialResponseSource),
  spatialResponseSource ? 'vocalPulse not present in buildSpatialResponse' : 'buildSpatialResponse not found'
)

addCheck(
  'audio:spatial-preserves-left-right-difference',
  /left:\s*Math\.min\(1\.0,\s*midHighL\s*\*\s*1\.12\)/.test(spatialResponseSource)
    && /right:\s*Math\.min\(1\.0,\s*midHighR\s*\*\s*1\.12\)/.test(spatialResponseSource),
  'left/right derive from their own mid-high channel'
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
