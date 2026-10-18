import { ConvexError, v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from '../_generated/server'
import { PROVIDER_IDS, getKeyRequirements } from '../../shared/providers'
import { requireKeyOwner } from './identity'
import { encryptedKey, providerId } from './validators'
import type { QueryCtx } from '../_generated/server'

async function readOwnerKeys(ctx: QueryCtx, ownerTokenIdentifier: string) {
  return await ctx.db
    .query('providerKeys')
    .withIndex('by_ownerTokenIdentifier_and_provider', (q) =>
      q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
    )
    .take(PROVIDER_IDS.length)
}

/** Only masked metadata can leave the server. No API accepts an owner argument. */
export const status = query({
  args: {},
  returns: v.object({
    keys: v.array(v.object({ id: providerId, keyHint: v.string() })),
    hasEmbeddings: v.boolean(),
    hasChatProvider: v.boolean(),
    ready: v.boolean(),
  }),
  handler: async (ctx) => {
    const keys = await readOwnerKeys(ctx, await requireKeyOwner(ctx))
    return {
      keys: keys.map(({ provider, keyHint }) => ({ id: provider, keyHint })),
      ...getKeyRequirements(keys.map(({ provider }) => provider)),
    }
  },
})

export const remove = mutation({
  args: { provider: providerId },
  returns: v.null(),
  handler: async (ctx, { provider }) => {
    const owner = await requireKeyOwner(ctx)
    const key = await ctx.db
      .query('providerKeys')
      .withIndex('by_ownerTokenIdentifier_and_provider', (q) =>
        q.eq('ownerTokenIdentifier', owner).eq('provider', provider),
      )
      .unique()
    if (key) await ctx.db.delete('providerKeys', key._id)
    return null
  },
})

export const storeVerified = internalMutation({
  args: { provider: providerId, encrypted: encryptedKey, keyHint: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await requireKeyOwner(ctx)
    const existing = await ctx.db
      .query('providerKeys')
      .withIndex('by_ownerTokenIdentifier_and_provider', (q) =>
        q
          .eq('ownerTokenIdentifier', ownerTokenIdentifier)
          .eq('provider', args.provider),
      )
      .unique()
    const values = { ...args, ownerTokenIdentifier, verifiedAt: Date.now() }
    if (existing) await ctx.db.replace('providerKeys', existing._id, values)
    else await ctx.db.insert('providerKeys', values)
    return null
  },
})

/** Server-only credential path for future model/embedding actions; no shared-key fallback. */
export const forUse = internalQuery({
  args: { provider: providerId },
  returns: v.object({
    ownerTokenIdentifier: v.string(),
    encrypted: encryptedKey,
  }),
  handler: async (ctx, { provider }) => {
    const ownerTokenIdentifier = await requireKeyOwner(ctx)
    const keys = await readOwnerKeys(ctx, ownerTokenIdentifier)
    if (!getKeyRequirements(keys.map((key) => key.provider)).ready) {
      throw new ConvexError(
        'Add your Google embeddings key and at least one chat provider key in Settings.',
      )
    }
    const key = keys.find((entry) => entry.provider === provider)
    if (!key)
      throw new ConvexError('Add your API key for this provider in Settings.')
    return { ownerTokenIdentifier, encrypted: key.encrypted }
  },
})
