import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { encryptedKey, providerId } from './providers/validators'
import { conversationSummary, turn } from './chat/validators'

export default defineSchema({
  conversations: defineTable({
    ...conversationSummary.omit('_id').fields,
    ownerTokenIdentifier: v.string(),
    activeTurn: v.optional(turn),
  })
    .index('by_ownerTokenIdentifier_and_updatedAt', [
      'ownerTokenIdentifier',
      'updatedAt',
    ])
    .index('by_threadId', ['threadId'])
    .searchIndex('search_title', {
      searchField: 'title',
      filterFields: ['ownerTokenIdentifier'],
    }),
  chatRequests: defineTable({
    ownerTokenIdentifier: v.string(),
    requestId: v.string(),
    conversationId: v.id('conversations'),
    threadId: v.string(),
  }).index('by_ownerTokenIdentifier_and_requestId', [
    'ownerTokenIdentifier',
    'requestId',
  ]),
  providerKeys: defineTable({
    ownerTokenIdentifier: v.string(),
    provider: providerId,
    encrypted: encryptedKey,
    keyHint: v.string(),
    verifiedAt: v.number(),
  }).index('by_ownerTokenIdentifier_and_provider', [
    'ownerTokenIdentifier',
    'provider',
  ]),
  numbers: defineTable({
    value: v.number(),
  }),

  users: defineTable({
    tokenIdentifier: v.string(),
    theme: v.union(v.literal('system'), v.literal('light'), v.literal('dark')),
    onboardingComplete: v.boolean(),
    updatedAt: v.number(),
  }).index('by_tokenIdentifier', ['tokenIdentifier']),
})
