#!/usr/bin/env node

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

const CONFIG_DIR = join(homedir(), '.pixelsetu-word')
const KEY_FILE = join(CONFIG_DIR, 'gemini.key.enc')

function deriveKey() {
  const machineId = `${process.env.USER ?? 'user'}-${homedir()}-pixelsetu-word`
  return createHash('sha256').update(machineId).digest()
}

function encrypt(plaintext) {
  const key = deriveKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  })
}

function decrypt(payload) {
  const { iv, tag, data } = JSON.parse(payload)
  const key = deriveKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function setKey() {
  const apiKey = await promptHidden('Enter Gemini API key: ')
  if (!apiKey) {
    console.error('Error: API key cannot be empty')
    process.exit(1)
  }

  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }

  writeFileSync(KEY_FILE, encrypt(apiKey), { mode: 0o600 })
  console.log('Gemini API key saved (encrypted) to', KEY_FILE)
  console.log('Note: Browser agents use in-app storage. Set key in dev terminal with: gemini --set-key')
}

function showStatus() {
  if (!existsSync(KEY_FILE)) {
    console.log('No Gemini API key configured.')
    console.log('Run: gemini --set-key')
    return
  }

  try {
    const key = decrypt(readFileSync(KEY_FILE, 'utf8'))
    const masked = key.length <= 8 ? '****' : `${key.slice(0, 4)}...${key.slice(-4)}`
    console.log(`Gemini API key: ${masked} (encrypted at ${KEY_FILE})`)
  } catch {
    console.error('Failed to read encrypted key. Run: gemini --set-key')
    process.exit(1)
  }
}

function clearKey() {
  if (existsSync(KEY_FILE)) {
    writeFileSync(KEY_FILE, '')
    console.log('Gemini API key cleared.')
  } else {
    console.log('No key to clear.')
  }
}

function showHelp() {
  console.log(`pixelsetu-word gemini CLI

Usage:
  gemini --set-key     Save Gemini API key (encrypted)
  gemini --status      Show key status
  gemini --clear       Remove saved key
  gemini --help        Show this help
`)
}

const args = process.argv.slice(2)

if (args.includes('--set-key')) {
  await setKey()
} else if (args.includes('--status')) {
  showStatus()
} else if (args.includes('--clear')) {
  clearKey()
} else if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  showHelp()
} else {
  console.error(`Unknown option: ${args.join(' ')}`)
  showHelp()
  process.exit(1)
}
