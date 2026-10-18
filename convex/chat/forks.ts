import { createThread } from '@convex-dev/agent'
import {
  WorkflowManager,
  cleanup,
  start,
  vResultValidator,
  vWorkflowId,
} from '@convex-dev/workflow'
import { ConvexError, v } from 'convex/values'
import { components, internal } from '../_generated/api'
import { internalMutation, mutation } from '../_generated/server'
import { resolveChatModel } from '../../shared/models'
import { requireConversation } from './ownership'
import { draftContent } from './validators'
import { findDraft, validateDraftKey } from './drafts'
import { referenceInConversation } from './files'
import type { Id } from '../_generated/dataModel'

const workflow = new WorkflowManager(components.workflow)
const forkResult = v.object({ conversationId: v.id('conversations') })

/** Reserve the destination and its preferences atomically; only server-owned threads reach the copier. */
export const create = mutation({
  args: {
    conversationId: v.id('conversations'),
    messageId: v.string(),
    requestId: v.string(),
    preferences: draftContent.fields.preferences,
  },
  returns: forkResult,
  handler: async (
    ctx,
    args,
  ): Promise<{ conversationId: Id<'conversations'> }> => {
    const source = await requireConversation(ctx, args.conversationId)
    validateDraftKey(args.requestId)
    const previous = await ctx.db
      .query('conversations')
      .withIndex('by_ownerTokenIdentifier_and_forkRequestId', (q) =>
        q
          .eq('ownerTokenIdentifier', source.ownerTokenIdentifier)
          .eq('forkRequestId', args.requestId),
      )
      .unique()
    if (previous) return { conversationId: previous._id }
    if (source.status === 'forking' || source.status === 'fork-error')
      throw new ConvexError('Wait for a completed conversation before forking.')
    if (!resolveChatModel(args.preferences.model, args.preferences.mode))
      throw new ConvexError('Choose a supported model and mode.')
    const [message] = await ctx.runQuery(
      components.agent.messages.getMessagesByIds,
      {
        messageIds: [args.messageId],
      },
    )
    if (
      !message ||
      message.threadId !== source.threadId ||
      message.message?.role !== 'assistant' ||
      message.status !== 'success' ||
      source.activeTurn?.order === message.order
    )
      throw new ConvexError('Choose a completed assistant reply to fork.')
    if (await findDraft(ctx, source.ownerTokenIdentifier, args.requestId))
      throw new ConvexError('Start this fork again.')
    const threadId = await createThread(ctx, components.agent, {
      userId: source.ownerTokenIdentifier,
      title: source.title,
    })
    const conversationId = await ctx.db.insert('conversations', {
      ownerTokenIdentifier: source.ownerTokenIdentifier,
      threadId,
      title: source.title,
      updatedAt: Date.now(),
      status: 'forking',
      draftKey: args.requestId,
      sourceConversationId: source._id,
      forkRequestId: args.requestId,
    })
    await ctx.db.insert('chatDrafts', {
      ownerTokenIdentifier: source.ownerTokenIdentifier,
      draftKey: args.requestId,
      conversationId,
      writerId: args.requestId,
      sequence: 1,
      version: args.requestId,
      text: '',
      quotes: [],
      uploadIds: [],
      preferences: args.preferences,
      updatedAt: Date.now(),
    })
    const workflowId = await start(
      ctx,
      internal.chat.forks.copy,
      {
        sourceConversationId: source._id,
        conversationId,
        sourceThreadId: source.threadId,
        targetThreadId: threadId,
        messageId: args.messageId,
        upToOrder: message.order,
      },
      {
        startAsync: true,
        onComplete: internal.chat.forks.complete,
        context: { conversationId },
      },
    )
    await ctx.db.patch('conversations', conversationId, {
      forkWorkflowId: workflowId,
    })
    return { conversationId }
  },
})

export const copy = workflow
  .define({
    args: {
      sourceConversationId: v.id('conversations'),
      conversationId: v.id('conversations'),
      sourceThreadId: v.string(),
      targetThreadId: v.string(),
      messageId: v.string(),
      // Optional so workflows started before graph history existed still replay.
      upToOrder: v.optional(v.number()),
    },
    returns: v.null(),
  })
  .handler(async (step, args): Promise<null> => {
    let cursor: string | null = null
    let done = false
    while (!done) {
      const page: { cursor: string; done: boolean } = await step.runMutation(
        internal.chat.forks.copyReferences,
        {
          sourceConversationId: args.sourceConversationId,
          conversationId: args.conversationId,
          cursor,
        },
      )
      cursor = page.cursor
      done = page.done
    }
    // Graph history for the selected prefix: every turn up to the forked reply's order.
    if (args.upToOrder !== undefined) {
      cursor = null
      done = false
      while (!done) {
        const page: { cursor: string; done: boolean } = await step.runMutation(
          internal.chat.graph.copyHistory,
          {
            sourceConversationId: args.sourceConversationId,
            conversationId: args.conversationId,
            upToOrder: args.upToOrder,
            cursor,
          },
        )
        cursor = page.cursor
        done = page.done
      }
    }
    // The component copies complete Agent orders (including tool steps and reasoning).
    // Do not retry a partially committed clone action; a failed destination stays blocked.
    await step.runAction(
      components.agent.messages.cloneThread,
      {
        sourceThreadId: args.sourceThreadId,
        targetThreadId: args.targetThreadId,
        upToAndIncludingMessageId: args.messageId,
        batchSize: 50,
      },
      { retry: false },
    )
    return null
  })

/** App-owned storage is separate from Agent files. Conservatively retain all source uploads. */
export const copyReferences = internalMutation({
  args: {
    sourceConversationId: v.id('conversations'),
    conversationId: v.id('conversations'),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({ cursor: v.string(), done: v.boolean() }),
  handler: async (ctx, args) => {
    const source = await ctx.db.get('conversations', args.sourceConversationId)
    const target = await ctx.db.get('conversations', args.conversationId)
    if (
      !source ||
      !target ||
      target.status !== 'forking' ||
      target.sourceConversationId !== source._id ||
      source.ownerTokenIdentifier !== target.ownerTokenIdentifier
    )
      throw new Error('Fork source or destination is unavailable')
    const refs = await ctx.db
      .query('chatFileReferences')
      .withIndex('by_conversationId', (q) => q.eq('conversationId', source._id))
      .paginate({ cursor: args.cursor, numItems: 50 })
    for (const ref of refs.page) {
      const upload = await ctx.db.get('chatUploads', ref.uploadId)
      if (
        !upload ||
        upload.ownerTokenIdentifier !== target.ownerTokenIdentifier
      )
        throw new Error('Fork attachment is unavailable')
      await referenceInConversation(ctx, ref.uploadId, target._id)
    }
    return { cursor: refs.continueCursor, done: refs.isDone }
  },
})

export const complete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ conversationId: v.id('conversations') }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(
      'conversations',
      args.context.conversationId,
    )
    if (
      target?.forkWorkflowId === args.workflowId &&
      target.status === 'forking'
    ) {
      await ctx.db.patch('conversations', target._id, {
        status: args.result.kind === 'success' ? 'idle' : 'fork-error',
        error:
          args.result.kind === 'success'
            ? undefined
            : 'Couldn’t finish copying this conversation. Return to the original chat and fork again. You can delete this incomplete copy from Recents.',
        forkWorkflowId: undefined,
        updatedAt: Date.now(),
      })
    }
    await cleanup(ctx, components.workflow, args.workflowId)
    return null
  },
})
