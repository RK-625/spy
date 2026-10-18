import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server'
import { toModelMessage } from '@convex-dev/agent'
import { v } from 'convex/values'
import { components, internal } from '../_generated/api'
import { internalMutation, internalQuery, query } from '../_generated/server'
import { encryptedKey, providerId } from '../providers/validators'
import { getKeyRequirements } from '../../shared/providers'
import { resolveChatModel } from '../../shared/models'
import { requireConversation } from './ownership'
import {
  GRAPH_HISTORY_MAX_CHARS,
  GRAPH_HISTORY_MAX_MESSAGES,
  boundedGraphJson,
  serializeGraphMessage,
} from './graphHistory'
import { graphMessageSource, graphPaneStatus } from './validators'
import type { Infer } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { turn } from './validators'

type GraphSource = Infer<typeof graphMessageSource>

/** The maintainer action has a five-minute abort; this frees the queue if it never reports back. */
const RECOVER_AFTER_MS = 9 * 60 * 1000
const PURGE_BATCH = 100
const COPY_BATCH = 50

// ---------------------------------------------------------------------------
// Queue

/** Start the oldest queued job when none is running. Claims are atomic, so a duplicate schedule is a no-op. */
async function kick(ctx: MutationCtx, conversationId: Id<'conversations'>) {
  const running = await ctx.db
    .query('graphJobs')
    .withIndex('by_conversationId_and_status', (q) =>
      q.eq('conversationId', conversationId).eq('status', 'running'),
    )
    .first()
  if (running) return
  const next = await ctx.db
    .query('graphJobs')
    .withIndex('by_conversationId_and_status', (q) =>
      q.eq('conversationId', conversationId).eq('status', 'queued'),
    )
    .first()
  if (next)
    await ctx.scheduler.runAfter(0, internal.chat.graphAgent.maintain, {
      jobId: next._id,
    })
}

/**
 * Called when a normal chat turn ends. Build-mode turns stay out of graph
 * history entirely; other turns always record the user message, and only
 * completed turns (runAgent) may start the maintainer.
 */
export async function enqueueGraphJob(
  ctx: MutationCtx,
  chat: Doc<'conversations'>,
  activeTurn: Infer<typeof turn>,
  runAgent: boolean,
) {
  if (activeTurn.useBuildMode === true) return
  await ctx.db.insert('graphJobs', {
    conversationId: chat._id,
    ownerTokenIdentifier: chat.ownerTokenIdentifier,
    promptMessageId: activeTurn.promptMessageId,
    order: activeTurn.order,
    model: activeTurn.model,
    mode: activeTurn.mode,
    runAgent,
    status: 'queued',
    updatedAt: Date.now(),
  })
  await kick(ctx, chat._id)
}

async function appendRows(
  ctx: MutationCtx,
  conversationId: Id<'conversations'>,
  order: number,
  graphSource: GraphSource,
  rows: Array<string>,
) {
  if (rows.length === 0) return
  const last = await ctx.db
    .query('graphMessages')
    .withIndex('by_conversationId_and_sequence', (q) =>
      q.eq('conversationId', conversationId),
    )
    .order('desc')
    .first()
  let sequence = (last?.sequence ?? -1) + 1
  for (const row of rows) {
    const json = boundedGraphJson(row)
    if (json === null) continue
    await ctx.db.insert('graphMessages', {
      conversationId,
      sequence,
      order,
      graphSource,
      json,
    })
    sequence += 1
  }
}

async function settle(
  ctx: MutationCtx,
  job: Doc<'graphJobs'>,
  status: 'done' | 'failed' | 'skipped',
) {
  await ctx.db.patch('graphJobs', job._id, { status, updatedAt: Date.now() })
  await kick(ctx, job.conversationId)
}

type StoredMessage = {
  _id: string
  order: number
  stepOrder: number
  status: string
  message?: unknown
}

function toolCalls(content: unknown) {
  return Array.isArray(content)
    ? content.filter(
        (
          part,
        ): part is { type: string; toolCallId: string; toolName: string } =>
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          'toolCallId' in part &&
          typeof part.toolCallId === 'string',
      )
    : []
}

/** Client-side askUserQuestion stops the loop with no result; the user answers next turn. */
function waitingOnUser(response: Array<StoredMessage>) {
  const parts = response.flatMap((doc) =>
    toolCalls(
      typeof doc.message === 'object' && doc.message && 'content' in doc.message
        ? doc.message.content
        : undefined,
    ),
  )
  const answered = new Set(
    parts
      .filter((part) => part.type === 'tool-result')
      .map((part) => part.toolCallId),
  )
  return parts.some(
    (part) =>
      part.type === 'tool-call' &&
      part.toolName === 'askUserQuestion' &&
      !answered.has(part.toolCallId),
  )
}

function serializeStored(doc: StoredMessage) {
  if (!doc.message) return null
  try {
    return serializeGraphMessage(
      toModelMessage(doc.message as Parameters<typeof toModelMessage>[0]),
    )
  } catch {
    return null
  }
}

/**
 * Claim a queued job for the maintainer action. The user turn always lands in
 * graph history; aborted, failed, empty and question-pending turns stop there.
 * The owner and key come from the stored conversation, never from a caller.
 */
export const claim = internalMutation({
  args: { jobId: v.id('graphJobs') },
  returns: v.union(
    v.null(),
    v.object({
      ownerTokenIdentifier: v.string(),
      model: v.string(),
      mode: v.string(),
      provider: providerId,
      encrypted: encryptedKey,
    }),
  ),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get('graphJobs', jobId)
    if (!job || job.status !== 'queued') return null
    const oldest = await ctx.db
      .query('graphJobs')
      .withIndex('by_conversationId_and_status', (q) =>
        q.eq('conversationId', job.conversationId).eq('status', 'queued'),
      )
      .first()
    const running = await ctx.db
      .query('graphJobs')
      .withIndex('by_conversationId_and_status', (q) =>
        q.eq('conversationId', job.conversationId).eq('status', 'running'),
      )
      .first()
    if (running) return null
    if (oldest?._id !== job._id) {
      await kick(ctx, job.conversationId)
      return null
    }
    const chat = await ctx.db.get('conversations', job.conversationId)
    if (!chat || chat.ownerTokenIdentifier !== job.ownerTokenIdentifier) {
      await settle(ctx, job, 'skipped')
      return null
    }
    let turnMessages: Array<StoredMessage>
    try {
      const page = await ctx.runQuery(
        components.agent.messages.listMessagesByThreadId,
        {
          threadId: chat.threadId,
          order: 'desc',
          upToAndIncludingMessageId: job.promptMessageId,
          paginationOpts: { cursor: null, numItems: 100 },
        },
      )
      turnMessages = page.page
        .filter((doc) => doc.order === job.order)
        .reverse()
    } catch {
      await settle(ctx, job, 'skipped')
      return null
    }
    const prompt = turnMessages.find((doc) => doc._id === job.promptMessageId)
    const promptRow = prompt ? serializeStored(prompt) : null
    await appendRows(
      ctx,
      job.conversationId,
      job.order,
      'chat',
      promptRow ? [promptRow] : [],
    )
    const response = turnMessages.filter(
      (doc) => doc._id !== job.promptMessageId && doc.status === 'success',
    )
    if (!job.runAgent || response.length === 0 || waitingOnUser(response)) {
      await settle(ctx, job, 'skipped')
      return null
    }
    const responseRows = response
      .map(serializeStored)
      .filter((row): row is string => row !== null)
    if (responseRows.length === 0) {
      await settle(ctx, job, 'skipped')
      return null
    }
    await appendRows(ctx, job.conversationId, job.order, 'chat', responseRows)
    const selected = resolveChatModel(job.model, job.mode)
    const keys = await ctx.db
      .query('providerKeys')
      .withIndex('by_ownerTokenIdentifier_and_provider', (q) =>
        q.eq('ownerTokenIdentifier', chat.ownerTokenIdentifier),
      )
      .take(6)
    const key = selected
      ? keys.find((entry) => entry.provider === selected.provider)
      : undefined
    if (
      !key ||
      !getKeyRequirements(keys.map((entry) => entry.provider)).ready
    ) {
      await settle(ctx, job, 'skipped')
      return null
    }
    await ctx.db.patch('graphJobs', job._id, {
      status: 'running',
      updatedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(
      RECOVER_AFTER_MS,
      internal.chat.graph.recover,
      {
        jobId,
      },
    )
    return {
      ownerTokenIdentifier: chat.ownerTokenIdentifier,
      model: job.model,
      mode: job.mode,
      provider: key.provider,
      encrypted: key.encrypted,
    }
  },
})

/** Maintainer tool access: the owner of a still-running job's conversation. Writes are allowed only then. */
export const access = internalQuery({
  args: { jobId: v.id('graphJobs') },
  returns: v.union(
    v.null(),
    v.object({ ownerTokenIdentifier: v.string(), buildMode: v.boolean() }),
  ),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get('graphJobs', jobId)
    if (job?.status !== 'running') return null
    const chat = await ctx.db.get('conversations', job.conversationId)
    if (!chat || chat.ownerTokenIdentifier !== job.ownerTokenIdentifier)
      return null
    return { ownerTokenIdentifier: chat.ownerTokenIdentifier, buildMode: true }
  },
})

/** Newest graph history for the model, oldest first, bounded by count and size. */
export const modelHistory = internalQuery({
  args: { jobId: v.id('graphJobs') },
  returns: v.array(v.string()),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get('graphJobs', jobId)
    if (job?.status !== 'running') return []
    const rows: Array<string> = []
    let chars = 0
    for await (const row of ctx.db
      .query('graphMessages')
      .withIndex('by_conversationId_and_sequence', (q) =>
        q.eq('conversationId', job.conversationId),
      )
      .order('desc')) {
      if (
        rows.length >= GRAPH_HISTORY_MAX_MESSAGES ||
        chars + row.json.length > GRAPH_HISTORY_MAX_CHARS
      )
        break
      rows.push(row.json)
      chars += row.json.length
    }
    return rows.reverse()
  },
})

/** Stream one maintainer step into graph history while its job is running. */
export const append = internalMutation({
  args: { jobId: v.id('graphJobs'), rows: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { jobId, rows }) => {
    const job = await ctx.db.get('graphJobs', jobId)
    if (job?.status !== 'running') return null
    if (!(await ctx.db.get('conversations', job.conversationId))) return null
    await appendRows(ctx, job.conversationId, job.order, 'graph', rows)
    return null
  },
})

export const complete = internalMutation({
  args: { jobId: v.id('graphJobs'), failed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { jobId, failed }) => {
    const job = await ctx.db.get('graphJobs', jobId)
    if (job?.status === 'running')
      await settle(ctx, job, failed ? 'failed' : 'done')
    return null
  },
})

export const recover = internalMutation({
  args: { jobId: v.id('graphJobs') },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get('graphJobs', jobId)
    if (job?.status === 'running') await settle(ctx, job, 'failed')
    return null
  },
})

// ---------------------------------------------------------------------------
// Graph pane

/** Running while a job runs; otherwise the latest finished run. Skipped turns keep the previous state. */
export const status = query({
  args: { conversationId: v.id('conversations') },
  returns: graphPaneStatus,
  handler: async (ctx, { conversationId }) => {
    await requireConversation(ctx, conversationId)
    const latest = (jobStatus: 'running' | 'done' | 'failed') =>
      ctx.db
        .query('graphJobs')
        .withIndex('by_conversationId_and_status', (q) =>
          q.eq('conversationId', conversationId).eq('status', jobStatus),
        )
        .order('desc')
        .first()
    if (await latest('running')) return 'running'
    const [done, failed] = await Promise.all([latest('done'), latest('failed')])
    return failed && (!done || failed._creationTime > done._creationTime)
      ? 'failed'
      : 'idle'
  },
})

/** Newest-first graph history pages for the pane. Each row is one ModelMessage JSON. */
export const history = query({
  args: {
    conversationId: v.id('conversations'),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      _id: v.id('graphMessages'),
      sequence: v.number(),
      graphSource: graphMessageSource,
      json: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireConversation(ctx, args.conversationId)
    const result = await ctx.db
      .query('graphMessages')
      .withIndex('by_conversationId_and_sequence', (q) =>
        q.eq('conversationId', args.conversationId),
      )
      .order('desc')
      .paginate(args.paginationOpts)
    return {
      ...result,
      page: result.page.map((row) => ({
        _id: row._id,
        sequence: row.sequence,
        graphSource: row.graphSource,
        json: row.json,
      })),
    }
  },
})

// ---------------------------------------------------------------------------
// Fork and delete

/** True while a maintainer job for a turn at or before the fork point is still queued or running. */
export const forkPending = internalQuery({
  args: {
    sourceConversationId: v.id('conversations'),
    upToOrder: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, { sourceConversationId, upToOrder }) => {
    for (const jobStatus of ['queued', 'running'] as const) {
      const jobs = await ctx.db
        .query('graphJobs')
        .withIndex('by_conversationId_and_status', (q) =>
          q.eq('conversationId', sourceConversationId).eq('status', jobStatus),
        )
        .take(100)
      if (jobs.some((job) => job.order <= upToOrder)) return true
    }
    return false
  },
})

/** Copy the source's graph history for turns up to and including the forked order. */
export const copyHistory = internalMutation({
  args: {
    sourceConversationId: v.id('conversations'),
    conversationId: v.id('conversations'),
    upToOrder: v.number(),
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
    const rows = await ctx.db
      .query('graphMessages')
      .withIndex('by_conversationId_and_sequence', (q) =>
        q.eq('conversationId', source._id),
      )
      .paginate({ cursor: args.cursor, numItems: COPY_BATCH })
    for (const row of rows.page) {
      // Turn orders increase with sequence, so the first later turn ends the prefix.
      if (row.order > args.upToOrder)
        return { cursor: rows.continueCursor, done: true }
      await ctx.db.insert('graphMessages', {
        conversationId: target._id,
        sequence: row.sequence,
        order: row.order,
        graphSource: row.graphSource,
        json: row.json,
      })
    }
    return { cursor: rows.continueCursor, done: rows.isDone }
  },
})

/** Delete a removed conversation's graph history and jobs in bounded batches. */
export const purge = internalMutation({
  args: { conversationId: v.id('conversations') },
  returns: v.null(),
  handler: async (ctx, { conversationId }) => {
    const rows = await ctx.db
      .query('graphMessages')
      .withIndex('by_conversationId_and_sequence', (q) =>
        q.eq('conversationId', conversationId),
      )
      .take(PURGE_BATCH)
    for (const row of rows) await ctx.db.delete('graphMessages', row._id)
    const jobs = await ctx.db
      .query('graphJobs')
      .withIndex('by_conversationId_and_status', (q) =>
        q.eq('conversationId', conversationId),
      )
      .take(PURGE_BATCH)
    for (const job of jobs) await ctx.db.delete('graphJobs', job._id)
    if (rows.length === PURGE_BATCH || jobs.length === PURGE_BATCH)
      await ctx.scheduler.runAfter(0, internal.chat.graph.purge, {
        conversationId,
      })
    return null
  },
})
