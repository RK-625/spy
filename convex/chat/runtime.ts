import { abortStream } from '@convex-dev/agent'
import { v } from 'convex/values'
import { internalMutation, internalQuery } from '../_generated/server'
import { components } from '../_generated/api'
import { encryptedKey, providerId } from '../providers/validators'
import { getKeyRequirements } from '../../shared/providers'
import { resolveChatModel } from '../../shared/models'
import { turn } from './validators'

export const runArgs = {
  conversationId: v.id('conversations'),
  requestId: v.string(),
}

/** A single scheduled worker claims the turn. Stop-before-start never calls a provider. */
export const begin = internalMutation({
  args: runArgs,
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get('conversations', args.conversationId)
    if (!chat || chat.activeTurn?.requestId !== args.requestId) return false
    if (chat.status === 'stopping') {
      await ctx.db.patch('conversations', chat._id, {
        activeTurn: undefined,
        status: 'idle',
      })
      return false
    }
    if (chat.status !== 'queued') return false
    await ctx.db.patch('conversations', chat._id, { status: 'streaming' })
    return true
  },
})

/** Scheduled actions have no user session. Resolve ownership from the server-created turn. */
export const context = internalQuery({
  args: runArgs,
  returns: v.union(
    v.null(),
    v.object({
      ownerTokenIdentifier: v.string(),
      threadId: v.string(),
      turn,
      provider: providerId,
      encrypted: encryptedKey,
    }),
  ),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get('conversations', args.conversationId)
    if (
      !chat ||
      chat.activeTurn?.requestId !== args.requestId ||
      chat.status !== 'streaming'
    )
      return null
    const selected = resolveChatModel(
      chat.activeTurn.model,
      chat.activeTurn.mode,
    )
    if (!selected) return null
    const keys = await ctx.db
      .query('providerKeys')
      .withIndex('by_ownerTokenIdentifier_and_provider', (q) =>
        q.eq('ownerTokenIdentifier', chat.ownerTokenIdentifier),
      )
      .take(6)
    const key = keys.find((entry) => entry.provider === selected.provider)
    if (!key || !getKeyRequirements(keys.map((entry) => entry.provider)).ready)
      return null
    return {
      ownerTokenIdentifier: chat.ownerTokenIdentifier,
      threadId: chat.threadId,
      turn: chat.activeTurn,
      provider: key.provider,
      encrypted: key.encrypted,
    }
  },
})

export const running = internalQuery({
  args: runArgs,
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get('conversations', args.conversationId)
    return (
      chat?.activeTurn?.requestId === args.requestId &&
      chat.status === 'streaming'
    )
  },
})

export const finish = internalMutation({
  args: { ...runArgs, failed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get('conversations', args.conversationId)
    if (chat?.activeTurn?.requestId === args.requestId) {
      const failed = args.failed && chat.status !== 'stopping'
      await ctx.db.patch('conversations', chat._id, {
        activeTurn: undefined,
        status: failed ? 'error' : 'idle',
        updatedAt: Date.now(),
        error: failed
          ? 'Couldn’t complete this response. Check your provider key, model access and connection, then try again.'
          : undefined,
      })
    }
    return null
  },
})

/** Recovery after the worker's four-minute abort deadline, including action infrastructure failures. */
export const recover = internalMutation({
  args: runArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get('conversations', args.conversationId)
    if (chat?.activeTurn?.requestId === args.requestId) {
      await abortStream(ctx, components.agent, {
        threadId: chat.threadId,
        order: chat.activeTurn.order,
        reason: 'Response timed out',
      })
      await ctx.db.patch('conversations', chat._id, {
        activeTurn: undefined,
        status: 'error',
        updatedAt: Date.now(),
        error: 'The response timed out. You can send another message.',
      })
    }
    return null
  },
})

export const expireReceipt = internalMutation({
  args: { receiptId: v.id('chatRequests') },
  returns: v.null(),
  handler: async (ctx, { receiptId }) => {
    await ctx.db.delete('chatRequests', receiptId)
    return null
  },
})
