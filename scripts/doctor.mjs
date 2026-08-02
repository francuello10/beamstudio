import os from 'node:os'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function safeCommand(command) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  } catch (error) {
    return `unavailable: ${error.message.split('\n')[0]}`
  }
}

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const report = {
  app: {
    name: packageJson.name,
    version: packageJson.version
  },
  runtime: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd()
  },
  session: {
    display: process.env.DISPLAY || null,
    waylandDisplay: process.env.WAYLAND_DISPLAY || null,
    xdgSessionType: process.env.XDG_SESSION_TYPE || null
  },
  os: {
    release: os.release(),
    type: os.type(),
    hostname: os.hostname()
  },
  commands: {
    uname: safeCommand('uname -a'),
    osRelease: safeCommand('cat /etc/os-release'),
    lsusb: safeCommand('lsusb'),
    lspci: safeCommand('lspci'),
    pactlSources: safeCommand('pactl list short sources'),
    pactlSinks: safeCommand('pactl list short sinks'),
    pipewireStatus: safeCommand('systemctl --user --no-pager --plain status pipewire pipewire-pulse wireplumber')
  }
}

console.log(JSON.stringify(report, null, 2))
