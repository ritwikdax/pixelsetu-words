const DB_NAME = 'pixelsetu-word-secrets'
const DB_VERSION = 1
const STORE_NAME = 'credentials'
const GEMINI_KEY_ID = 'gemini-api-key'
const DEVICE_KEY_STORAGE = 'pixelsetu-device-key'

interface EncryptedPayload {
  id: string
  ciphertext: string
  iv: string
  updatedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

function getOrCreateDeviceKey(): string {
  const existing = localStorage.getItem(DEVICE_KEY_STORAGE)
  if (existing) return existing

  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const key = btoa(String.fromCharCode(...bytes))
  localStorage.setItem(DEVICE_KEY_STORAGE, key)
  return key
}

async function deriveKey(deviceKey: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(deviceKey),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptValue(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const deviceKey = getOrCreateDeviceKey()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(deviceKey, salt)
  const encoded = new TextEncoder().encode(plaintext)

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(salt.length + encrypted.byteLength)
  combined.set(salt, 0)
  combined.set(new Uint8Array(encrypted), salt.length)

  return {
    ciphertext: btoa(String.fromCharCode(...combined)),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

async function decryptValue(ciphertext: string, ivB64: string): Promise<string> {
  const deviceKey = getOrCreateDeviceKey()
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  const salt = combined.slice(0, 16)
  const data = combined.slice(16)
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
  const key = await deriveKey(deviceKey, salt)

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

export async function setGeminiApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    throw new Error('API key cannot be empty')
  }

  const { ciphertext, iv } = await encryptValue(trimmed)
  const db = await openDb()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const payload: EncryptedPayload = {
      id: GEMINI_KEY_ID,
      ciphertext,
      iv,
      updatedAt: Date.now(),
    }
    store.put(payload)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getGeminiApiKey(): Promise<string | null> {
  const db = await openDb()

  const payload = await new Promise<EncryptedPayload | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(GEMINI_KEY_ID)
    request.onsuccess = () => resolve((request.result as EncryptedPayload) ?? null)
    request.onerror = () => reject(request.error)
  })

  if (!payload) return null

  try {
    return await decryptValue(payload.ciphertext, payload.iv)
  } catch {
    return null
  }
}

export async function clearGeminiApiKey(): Promise<void> {
  const db = await openDb()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(GEMINI_KEY_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function hasGeminiApiKey(): Promise<boolean> {
  const key = await getGeminiApiKey()
  return Boolean(key)
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}
