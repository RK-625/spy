import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { encryptedKey, providerId } from './providers/validators'
import {
  conversationSummary,
  draftContent,
  graphJobStatus,
  graphMessageSource,
  mcpAppMeta,
  turn,
} from './chat/validators'
import { memoryFields, memoryLinkType } from './memory/validators'
import { EMBEDDING_DIMENSION } from './memory/policy'

export default defineSchema({
  chatDrafts: defineTable({
    ownerTokenIdentifier: v.string(),
    draftKey: v.string(),
    conversationId: v.optional(v.id('conversations')),
    writerId: v.string(),
    sequence: v.number(),
    version: v.string(),
    ...draftContent.fields,
    updatedAt: v.number(),
  }).index('by_ownerTokenIdentifier_and_draftKey', [
    'ownerTokenIdentifier',
    'draftKey',
  ]),
  chatUploads: defineTable({
    ownerTokenIdentifier: v.string(),
    storageId: v.id('_storage'),
    filename: v.string(),
    mediaType: v.string(),
    size: v.number(),
  }),
  chatFileReferences: defineTable({
    uploadId: v.id('chatUploads'),
    draftId: v.optional(v.id('chatDrafts')),
    conversationId: v.optional(v.id('conversations')),
  })
    .index('by_uploadId_and_conversationId', ['uploadId', 'conversationId'])
    .index('by_draftId', ['draftId'])
    .index('by_conversationId', ['conversationId']),
  conversations: defineTable({
    ...conversationSummary.omit('_id').fields,
    ownerTokenIdentifier: v.string(),
    activeTurn: v.optional(turn),
    forkRequestId: v.optional(v.string()),
    forkWorkflowId: v.optional(v.string()),
  })
    .index('by_ownerTokenIdentifier_and_updatedAt', [
      'ownerTokenIdentifier',
      'updatedAt',
    ])
    .index('by_threadId', ['threadId'])
    .index('by_ownerTokenIdentifier_and_forkRequestId', [
      'ownerTokenIdentifier',
      'forkRequestId',
    ])
    .index('by_sourceConversationId_and_status', [
      'sourceConversationId',
      'status',
    ])
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
  /** Bounded, append-only maintainer transcript per conversation (one ModelMessage JSON per row). */
  graphMessages: defineTable({
    conversationId: v.id('conversations'),
    sequence: v.number(),
    /** Chat turn order the message belongs to; forks copy rows up to the forked order. */
    order: v.number(),
    graphSource: graphMessageSource,
    json: v.string(),
  }).index('by_conversationId_and_sequence', ['conversationId', 'sequence']),
  /** One maintainer job per eligible chat turn, serialized per conversation. */
  graphJobs: defineTable({
    conversationId: v.id('conversations'),
    ownerTokenIdentifier: v.string(),
    promptMessageId: v.string(),
    order: v.number(),
    model: v.string(),
    mode: v.string(),
    runAgent: v.boolean(),
    status: graphJobStatus,
    updatedAt: v.number(),
  }).index('by_conversationId_and_status', ['conversationId', 'status']),
  /** Shared MCP App UI resources from the fixed Excalidraw server, refreshed by chat turns. */
  mcpAppResources: defineTable({
    server: v.literal('excalidraw'),
    uri: v.string(),
    html: v.string(),
    meta: v.optional(mcpAppMeta),
    /** Model-visible tools whose results render this resource. */
    toolNames: v.array(v.string()),
    /** Tools the embedded app may call back through the authenticated proxy. */
    appToolNames: v.array(v.string()),
    updatedAt: v.number(),
  }).index('by_server_and_uri', ['server', 'uri']),
  memories: defineTable({
    ownerTokenIdentifier: v.string(),
    ...memoryFields,
    updatedAt: v.number(),
  }).index('by_ownerTokenIdentifier', ['ownerTokenIdentifier']),
  memoryLinks: defineTable({
    ownerTokenIdentifier: v.string(),
    source: v.id('memories'),
    target: v.id('memories'),
    type: memoryLinkType,
  })
    .index('by_ownerTokenIdentifier', ['ownerTokenIdentifier'])
    .index('by_source_and_type_and_target', ['source', 'type', 'target'])
    .index('by_target_and_type', ['target', 'type']),
  memoryQuestions: defineTable({
    ownerTokenIdentifier: v.string(),
    memoryId: v.id('memories'),
    text: v.string(),
    embedding: v.array(v.float64()),
  })
    .index('by_memoryId', ['memoryId'])
    .vectorIndex('by_embedding', {
      vectorField: 'embedding',
      dimensions: EMBEDDING_DIMENSION,
      filterFields: ['ownerTokenIdentifier'],
    }),
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
