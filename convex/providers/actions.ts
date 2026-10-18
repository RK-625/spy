'use node'

import { v } from 'convex/values'
import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import { requireKeyOwner } from './identity'
import { encryptKey } from './crypto'
import { verifyKey } from './verify'
import { keyOperationResult, providerId } from './validators'

export const save = action({
  args: { provider: providerId, apiKey: v.string() },
  returns: keyOperationResult,
  handler: async (ctx, { provider, apiKey }) => {
    const owner = await requireKeyOwner(ctx)
    const key = apiKey.trim()
    if (key.length < 8 || key.length > 4096 || /[\s\x00-\x1f\x7f]/.test(key)) {
      return {
        ok: false as const,
        error: 'Enter a valid API key (8–4096 characters, without spaces).',
      }
    }
    const verification = await verifyKey(provider, key)
    if (verification !== 'valid') {
      return {
        ok: false as const,
        error:
          verification === 'invalid'
            ? 'The provider rejected this key. Check its value and permissions.'
            : 'Couldn’t verify with the provider. Please try again later.',
      }
    }
    try {
      const encrypted = encryptKey(key, owner, provider)
      await ctx.runMutation(internal.providers.keys.storeVerified, {
        provider,
        encrypted,
        keyHint: key.slice(-4),
      })
      return { ok: true as const }
    } catch {
      return {
        ok: false as const,
        error: 'Couldn’t save your key. Please try again.',
      }
    }
  },
})
