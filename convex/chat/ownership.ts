import { ConvexError } from 'convex/values'
import { requireKeyOwner } from '../providers/identity'
import type { QueryCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

export async function requireConversation(
  ctx: QueryCtx,
  id: Id<'conversations'>,
) {
  const owner = await requireKeyOwner(ctx)
  const conversation = await ctx.db.get('conversations', id)
  if (!conversation || conversation.ownerTokenIdentifier !== owner) {
    throw new ConvexError('This conversation is unavailable.')
  }
  return conversation
}

export async function requireThread(ctx: QueryCtx, threadId: string) {
  const owner = await requireKeyOwner(ctx)
  const conversation = await ctx.db
    .query('conversations')
    .withIndex('by_threadId', (q) => q.eq('threadId', threadId))
    .unique()
  if (!conversation || conversation.ownerTokenIdentifier !== owner) {
    throw new ConvexError('This conversation is unavailable.')
  }
  return conversation
}
