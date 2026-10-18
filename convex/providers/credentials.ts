'use node'

import { internal } from '../_generated/api'
import { decryptKey } from './crypto'
import type { ActionCtx } from '../_generated/server'
import type { ProviderId } from '../../shared/providers'

/** Import only from Node actions. Plaintext stays server-side and belongs to the caller. */
export async function requireProviderKey(
  ctx: ActionCtx,
  provider: ProviderId,
): Promise<string> {
  const stored = await ctx.runQuery(internal.providers.keys.forUse, {
    provider,
  })
  return decryptKey(stored.encrypted, stored.ownerTokenIdentifier, provider)
}
