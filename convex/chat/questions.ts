import { saveMessage } from '@convex-dev/agent'
import { ConvexError, v } from 'convex/values'
import { components } from '../_generated/api'
import { mutation } from '../_generated/server'
import { parseAskUserQuestion } from '../../shared/ask-user-question'
import { requireConversation } from './ownership'

/** Persist the source's cancelled tool result without starting another model turn. */
export const dismiss = mutation({
  args: {
    conversationId: v.id('conversations'),
    messageId: v.string(),
    toolCallId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conversation = await requireConversation(ctx, args.conversationId)
    if (
      conversation.activeTurn ||
      conversation.status === 'forking' ||
      conversation.status === 'fork-error'
    )
      throw new ConvexError(
        'Wait for the conversation to finish before dismissing this question.',
      )
    const copyingFork = await ctx.db
      .query('conversations')
      .withIndex('by_sourceConversationId_and_status', (q) =>
        q.eq('sourceConversationId', conversation._id).eq('status', 'forking'),
      )
      .first()
    if (copyingFork)
      throw new ConvexError(
        'Wait for its fork to finish copying before dismissing this question.',
      )
    const [anchor] = await ctx.runQuery(
      components.agent.messages.getMessagesByIds,
      { messageIds: [args.messageId] },
    )
    if (
      !anchor ||
      anchor.threadId !== conversation.threadId ||
      anchor.message?.role !== 'assistant'
    )
      throw new ConvexError('This question is unavailable.')
    const recent = await ctx.runQuery(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId: conversation.threadId,
        order: 'desc',
        paginationOpts: { cursor: null, numItems: 100 },
      },
    )
    if (recent.page[0]?.order !== anchor.order)
      throw new ConvexError('This question is no longer pending.')
    let found = false
    for (const doc of recent.page) {
      if (doc.order !== anchor.order || !Array.isArray(doc.message?.content))
        continue
      for (const part of doc.message.content) {
        if (part.type === 'tool-result' && part.toolCallId === args.toolCallId)
          return null
        if (
          part.type === 'tool-call' &&
          part.toolCallId === args.toolCallId &&
          part.toolName === 'askUserQuestion' &&
          parseAskUserQuestion(part.input ?? part.args)
        )
          found = true
      }
    }
    if (!found) throw new ConvexError('This question is unavailable.')
    await saveMessage(ctx, components.agent, {
      threadId: conversation.threadId,
      userId: conversation.ownerTokenIdentifier,
      order: anchor.order,
      message: {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: args.toolCallId,
            toolName: 'askUserQuestion',
            output: { type: 'json', value: { status: 'cancelled' } },
          },
        ],
      },
    })
    return null
  },
})
