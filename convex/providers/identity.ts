import { ConvexError } from 'convex/values'
import { authComponentClient } from '../auth'
import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server'

export async function requireKeyOwner(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError('Please log in to manage your API keys.')
  // Check the Better Auth session as well as the signed Convex identity.
  await authComponentClient.getAuthUser(ctx)
  return identity.tokenIdentifier
}
