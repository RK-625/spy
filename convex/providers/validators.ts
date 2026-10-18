import { v } from 'convex/values'
import { PROVIDER_IDS } from '../../shared/providers'

export const providerId = v.union(...PROVIDER_IDS.map((id) => v.literal(id)))
export const encryptedKey = v.object({
  ciphertext: v.string(),
  iv: v.string(),
  authTag: v.string(),
  encryptionVersion: v.literal(1),
})
export const keyOperationResult = v.union(
  v.object({ ok: v.literal(true) }),
  v.object({ ok: v.literal(false), error: v.string() }),
)
