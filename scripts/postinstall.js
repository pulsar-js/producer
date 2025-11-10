import pkg from '../package.json' with { type: 'json' }
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { createWriteStream, unlink } from 'fs'
import { mkdir } from 'fs/promises'
import https from 'https'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BIN_PATH = join(__dirname, '..', 'bin', 'pulsar-publish' + (process.platform === 'win32' ? '.exe' : ''))
const { bin } = pkg
const { version, name: app } = bin
const { arch, platform } = process
const asset = {
  darwin: {
    arm64: `${app}_darwin_arm64`,   // from "darwin-arm64"
    x64: `${app}_darwin_amd64`,   // from "darwin-x64"
  },
  linux: {
    arm: `${app}_linux_arm`,       // "linux-arm" → GOARCH=arm
    arm64: `${app}_linux_arm64`,     // "linux-arm64"
    x64: `${app}_linux_amd64`,     // "linux-x64"
    ia32: `${app}_linux_386`,       // "linux-ia32"
    loong64: `${app}_linux_loong64`,   // "linux-loong64"
    mips64le: `${app}_linux_mips64le`,  // "linux-mips64el"
    ppc64le: `${app}_linux_ppc64le`,   // "linux-ppc64"
    riscv64: `${app}_linux_riscv64`,   // "linux-riscv64"
    s390x: `${app}_linux_s390x`,     // "linux-s390x"
  },
  win32: {
    arm64: `${app}_windows_arm64.exe`,  // "win32-arm64"
    ia32: `${app}_windows_386.exe`,    // "win32-ia32"
    x64: `${app}_windows_amd64.exe`,  // "win32-x64"
  },
  freebsd: {
    arm64: `${app}_freebsd_arm64`,
    x64: `${app}_freebsd_amd64`,
  },
  netbsd: {
    arm64: `${app}_netbsd_arm64`,
    x64: `${app}_netbsd_amd64`,
  },
  openbsd: {
    arm64: `${app}_openbsd_arm64`,
    x64: `${app}_openbsd_amd64`,
  },
  sunos: {
    x64: `${app}_sunos_amd64`,
  },
  aix: {
    ppc64: `${app}_aix_ppc64`,
  },
  android: {
    arm: `${app}_android_arm`,
    arm64: `${app}_android_arm64`,
    x64: `${app}_android_amd64`,
  },
}
const sourceURL = `https://github.com/pulsar-js/producer-bin/releases/download/v${version}/${asset[platform]?.[arch]}`

async function download(url, destPath, redirects = 0) {
  await mkdir(dirname(destPath), { recursive: true })

  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'pulsar-producer-installer' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        if (redirects > 5) return reject(new Error('Too many redirects'))
        return resolve(download(res.headers.location, destPath, redirects + 1))
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`))
      }

      const file = createWriteStream(destPath, { mode: 0o755 })
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
      file.on('error', reject)
    }).on('error', reject)
  })
}

async function run() {
  await download(sourceURL, BIN_PATH)
}

await run().catch(console.error)
