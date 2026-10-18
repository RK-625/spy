import { v } from 'convex/values'

export const turn = v.object({
  requestId: v.string(),
  promptMessageId: v.string(),
  order: v.number(),
  model: v.string(),
  mode: v.string(),
})

export const conversationSummary = v.object({
  _id: v.id('conversations'),
  threadId: v.string(),
  title: v.string(),
  updatedAt: v.number(),
  status: v.union(
    v.literal('idle'),
    v.literal('queued'),
    v.literal('streaming'),
    v.literal('stopping'),
    v.literal('error'),
  ),
  error: v.optional(v.string()),
})
