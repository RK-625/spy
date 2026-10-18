import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { encryptedKey, providerId } from './providers/validators'

export default defineSchema({
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
