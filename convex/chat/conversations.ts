import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { abortStream, createThread, saveMessage } from '@convex-dev/agent'
import { components, internal } from '../_generated/api'
import { mutation, query } from '../_generated/server'
import { requireKeyOwner } from '../providers/identity'
import { resolveChatModel } from '../../shared/models'
import { getKeyRequirements } from '../../shared/providers'
import { requireConversation } from './ownership'
import { conversationSummary } from './validators'
import {
  consumeDraft,
  deleteDraft,
  findDraft,
  validateDraftKey,
} from './drafts'
import { ownedUploads, referenceInConversation } from './files'
import type { Doc } from '../_generated/dataModel'
import type { UserContent } from 'ai'

function summary(doc: Doc<'conversations'>) {
  return {
    _id: doc._id,
    threadId: doc.threadId,
    title: doc.title,
    updatedAt: doc.updatedAt,
    status: doc.status,
    error: doc.error,
    draftKey: doc.draftKey,
    sourceConversationId: doc.sourceConversationId,
  }
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(conversationSummary),
  handler: async (ctx, args) => {
    const owner = await requireKeyOwner(ctx)
    const result = await ctx.db
      .query('conversations')
      .withIndex('by_ownerTokenIdentifier_and_updatedAt', (q) =>
        q.eq('ownerTokenIdentifier', owner),
      )
      .order('desc')
      .paginate(args.paginationOpts)
    return { ...result, page: result.page.map(summary) }
  },
})

export const search = query({
  args: { text: v.string() },
  returns: v.array(conversationSummary),
  handler: async (ctx, { text }) => {
    const owner = await requireKeyOwner(ctx)
    if (!text.trim()) return []
    if (text.length > 200) throw new ConvexError('Search is too long.')
    const rows = await ctx.db
      .query('conversations')
      .withSearchIndex('search_title', (q) =>
        q.search('title', text.trim()).eq('ownerTokenIdentifier', owner),
      )
      .take(30)
    return rows.map(summary)
  },
})

export const get = query({
  args: { conversationId: v.optional(v.id('conversations')) },
  returns: v.union(conversationSummary, v.null()),
  handler: async (ctx, args) => {
    if (!args.conversationId) {
      await requireKeyOwner(ctx)
      return null
    }
    return summary(await requireConversation(ctx, args.conversationId))
  },
})

/** The prompt, thread and scheduled generation commit together. Network retries reuse a receipt. */
export const send = mutation({
  args: {
    conversationId: v.optional(v.id('conversations')),
    requestId: v.string(),
    text: v.string(),
    model: v.string(),
    mode: v.string(),
    useWebSearch: v.optional(v.boolean()),
    useBuildMode: v.optional(v.boolean()),
    uploadIds: v.optional(v.array(v.id('chatUploads'))),
    draftKey: v.optional(v.string()),
    draftVersion: v.optional(v.string()),
  },
  returns: v.object({
    conversationId: v.id('conversations'),
    threadId: v.string(),
  }),
  handler: async (ctx, args) => {
    const owner = await requireKeyOwner(ctx)
    if (!/^[\w-]{16,100}$/.test(args.requestId))
      throw new ConvexError('Invalid message request.')
    const receipt = await ctx.db
      .query('chatRequests')
      .withIndex('by_ownerTokenIdentifier_and_requestId', (q) =>
        q.eq('ownerTokenIdentifier', owner).eq('requestId', args.requestId),
      )
      .unique()
    if (receipt) {
      await requireConversation(ctx, receipt.conversationId)
      return {
        conversationId: receipt.conversationId,
        threadId: receipt.threadId,
      }
    }
    const text = args.text.trim()
    const uploads = await ownedUploads(ctx, owner, args.uploadIds ?? [])
    if ((!text && uploads.length === 0) || text.length > 100_000)
      throw new ConvexError('Enter a message under 100,000 characters.')
    if (args.draftKey) {
      validateDraftKey(args.draftKey)
      const draft = await findDraft(ctx, owner, args.draftKey)
      if (draft?.conversationId && draft.conversationId !== args.conversationId)
        throw new ConvexError(
          'This draft was already sent. Open its conversation from Recents.',
        )
    }
    const selected = resolveChatModel(args.model, args.mode)
    if (!selected) throw new ConvexError('Choose a supported model and mode.')
    const keys = await ctx.db
      .query('providerKeys')
      .withIndex('by_ownerTokenIdentifier_and_provider', (q) =>
        q.eq('ownerTokenIdentifier', owner),
      )
      .take(6)
    if (
      !getKeyRequirements(keys.map((key) => key.provider)).ready ||
      !keys.some((key) => key.provider === selected.provider)
    ) {
      throw new ConvexError(
        'Add your embeddings and model provider keys in Settings.',
      )
    }
    let conversationId = args.conversationId
    let threadId: string
    if (conversationId) {
      const existing = await requireConversation(ctx, conversationId)
      if (existing.status === 'forking' || existing.status === 'fork-error')
        throw new ConvexError('This conversation has not finished copying.')
      if (existing.activeTurn)
        throw new ConvexError('Wait for the current response or stop it first.')
      if (
        args.draftKey &&
        (existing.draftKey ?? existing._id) !== args.draftKey
      )
        throw new ConvexError('This draft belongs to another conversation.')
      threadId = existing.threadId
    } else {
      const title = (text || uploads[0]?.filename || 'New conversation')
        .replace(/\s+/g, ' ')
        .slice(0, 100)
      threadId = await createThread(ctx, components.agent, {
        userId: owner,
        title,
      })
      conversationId = await ctx.db.insert('conversations', {
        ownerTokenIdentifier: owner,
        threadId,
        title,
        updatedAt: Date.now(),
        status: 'idle',
        draftKey: args.draftKey,
      })
    }
    const content: UserContent = text ? [{ type: 'text', text }] : []
    for (const upload of uploads) {
      content.push(
        upload.mediaType.startsWith('image/')
          ? {
              type: 'image',
              image: new URL(upload.url),
              mediaType: upload.mediaType,
            }
          : {
              type: 'file',
              data: new URL(upload.url),
              mediaType: upload.mediaType,
              filename: upload.filename,
            },
      )
      await referenceInConversation(ctx, upload._id, conversationId)
    }
    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId,
      userId: owner,
      message: { role: 'user', content },
    })
    if (args.draftKey)
      await consumeDraft(
        ctx,
        owner,
        args.draftKey,
        conversationId,
        args.draftVersion,
      )
    await ctx.db.patch('conversations', conversationId, {
      status: 'queued',
      error: undefined,
      updatedAt: Date.now(),
      activeTurn: {
        requestId: args.requestId,
        promptMessageId: messageId,
        order: message.order,
        model: args.model,
        mode: args.mode,
        useWebSearch: Boolean(
          args.useWebSearch && keys.some((key) => key.provider === 'exa'),
        ),
        useBuildMode: args.useBuildMode === true,
      },
    })
    const receiptId = await ctx.db.insert('chatRequests', {
      ownerTokenIdentifier: owner,
      requestId: args.requestId,
      conversationId,
      threadId,
    })
    await ctx.scheduler.runAfter(
      24 * 60 * 60 * 1000,
      internal.chat.runtime.expireReceipt,
      { receiptId },
    )
    const run = { conversationId, requestId: args.requestId }
    await ctx.scheduler.runAfter(0, internal.chat.generate.reply, run)
    await ctx.scheduler.runAfter(
      6 * 60 * 1000,
      internal.chat.runtime.recover,
      run,
    )
    return { conversationId, threadId }
  },
})

export const stop = mutation({
  args: { conversationId: v.id('conversations') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conversation = await requireConversation(ctx, args.conversationId)
    if (conversation.activeTurn) {
      await ctx.db.patch('conversations', conversation._id, {
        status: 'stopping',
      })
      await abortStream(ctx, components.agent, {
        threadId: conversation.threadId,
        order: conversation.activeTurn.order,
        reason: 'Stopped by user',
      })
    }
    return null
  },
})

export const remove = mutation({
  args: { conversationId: v.id('conversations') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conversation = await requireConversation(ctx, args.conversationId)
    if (conversation.status === 'forking')
      throw new ConvexError('Wait for this conversation to finish copying.')
    const copyingFork = await ctx.db
      .query('conversations')
      .withIndex('by_sourceConversationId_and_status', (q) =>
        q.eq('sourceConversationId', conversation._id).eq('status', 'forking'),
      )
      .first()
    if (copyingFork)
      throw new ConvexError(
        'Wait for its fork to finish copying before deleting this conversation.',
      )
    if (conversation.activeTurn)
      throw new ConvexError(
        'Stop the response before deleting this conversation.',
      )
    await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
      threadId: conversation.threadId,
    })
    await deleteDraft(
      ctx,
      conversation.ownerTokenIdentifier,
      conversation.draftKey ?? conversation._id,
    )
    await ctx.scheduler.runAfter(
      0,
      internal.chat.files.releaseConversationFiles,
      { conversationId: conversation._id },
    )
    await ctx.db.delete('conversations', conversation._id)
    return null
  },
})
