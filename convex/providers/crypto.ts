'use node'

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '../_generated/server'
import type { Infer } from 'convex/values'
import type { ProviderId } from '../../shared/providers'
import type { encryptedKey } from './validators'

type EncryptedKey = Infer<typeof encryptedKey>

function encryptionKey() {
  const key = Buffer.from(env.PROVIDER_KEYS_ENCRYPTION_KEY, 'base64')
  if (key.length !== 32)
    throw new Error('Provider key encryption is not configured.')
  return key
}

function associatedData(owner: string, provider: ProviderId) {
  return Buffer.from(JSON.stringify(['spy-provider-key', 1, owner, provider]))
}

export function encryptKey(
  plaintext: string,
  owner: string,
  provider: ProviderId,
): EncryptedKey {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(associatedData(owner, provider))
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  return {
    encryptionVersion: 1,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  }
}

export function decryptKey(
  encrypted: EncryptedKey,
  owner: string,
  provider: ProviderId,
) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(encrypted.iv, 'base64'),
  )
  decipher.setAAD(associatedData(owner, provider))
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
