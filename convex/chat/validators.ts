import { v } from 'convex/values'

export const turn = v.object({
  requestId: v.string(),
  promptMessageId: v.string(),
  order: v.number(),
  model: v.string(),
  mode: v.string(),
  useWebSearch: v.optional(v.boolean()),
  useBuildMode: v.optional(v.boolean()),
  useExcalidraw: v.optional(v.boolean()),
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
    v.literal('forking'),
    v.literal('fork-error'),
  ),
  error: v.optional(v.string()),
  draftKey: v.optional(v.string()),
  sourceConversationId: v.optional(v.id('conversations')),
})

export const draftContent = v.object({
  text: v.string(),
  quotes: v.array(
    v.object({
      id: v.string(),
      sourceMessageId: v.string(),
      sourceRole: v.union(v.literal('user'), v.literal('assistant')),
      text: v.string(),
      plainText: v.string(),
    }),
  ),
  preferences: v.object({
    model: v.string(),
    mode: v.string(),
    useWebSearch: v.boolean(),
    useExcalidraw: v.boolean(),
    useBuildMode: v.boolean(),
  }),
  uploadIds: v.array(v.id('chatUploads')),
})

export const graphMessageSource = v.union(v.literal('chat'), v.literal('graph'))

export const graphJobStatus = v.union(
  v.literal('queued'),
  v.literal('running'),
  v.literal('done'),
  v.literal('failed'),
  v.literal('skipped'),
)

/** Pane-facing maintainer state; "idle" is a finished run. */
export const graphPaneStatus = v.union(
  v.literal('idle'),
  v.literal('running'),
  v.literal('failed'),
)

/** Sanitized MCP App resource metadata (sandbox CSP origins and requested permissions). */
export const mcpAppMeta = v.object({
  prefersBorder: v.optional(v.boolean()),
  csp: v.optional(
    v.object({
      connectDomains: v.optional(v.array(v.string())),
      resourceDomains: v.optional(v.array(v.string())),
      frameDomains: v.optional(v.array(v.string())),
    }),
  ),
  permissions: v.optional(
    v.object({
      camera: v.optional(v.boolean()),
      microphone: v.optional(v.boolean()),
      geolocation: v.optional(v.boolean()),
      clipboardWrite: v.optional(v.boolean()),
    }),
  ),
})
