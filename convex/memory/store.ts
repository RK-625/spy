import { ConvexError, v } from 'convex/values'
import { internalMutation, internalQuery } from '../_generated/server'
import { encryptedKey } from '../providers/validators'
import { ownedMemory } from './graph'
import { EMBEDDING_DIMENSION, MEMORY_DELETE_MAX_IDS } from './policy'
import { upsertMemoryError } from './rules'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

const BATCH = 256

/** Encrypted Google key for embeddings, owned by the given user. */
export const googleKey = internalQuery({
  args: { ownerTokenIdentifier: v.string() },
  returns: v.union(v.null(), encryptedKey),
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query('providerKeys')
      .withIndex('by_ownerTokenIdentifier_and_provider', (q) =>
        q
          .eq('ownerTokenIdentifier', args.ownerTokenIdentifier)
          .eq('provider', 'google'),
      )
      .unique()
    return key?.encrypted ?? null
  },
})

const embeddedQuestion = v.object({
  text: v.string(),
  embedding: v.array(v.float64()),
})

async function deleteQuestions(ctx: MutationCtx, memoryId: Id<'memories'>) {
  for (;;) {
    const rows = await ctx.db
      .query('memoryQuestions')
      .withIndex('by_memoryId', (q) => q.eq('memoryId', memoryId))
      .take(BATCH)
    for (const row of rows) await ctx.db.delete('memoryQuestions', row._id)
    if (rows.length < BATCH) return
  }
}

async function deleteIncidentLinks(ctx: MutationCtx, memoryId: Id<'memories'>) {
  for (;;) {
    const rows = [
      ...(await ctx.db
        .query('memoryLinks')
        .withIndex('by_source_and_type_and_target', (q) =>
          q.eq('source', memoryId),
        )
        .take(BATCH)),
      ...(await ctx.db
        .query('memoryLinks')
        .withIndex('by_target_and_type', (q) => q.eq('target', memoryId))
        .take(BATCH)),
    ]
    // A self-link would appear twice; links are deleted once.
    const ids = new Set(rows.map((row) => row._id))
    for (const id of ids) await ctx.db.delete('memoryLinks', id)
    if (rows.length === 0) return
  }
}

/**
 * Source upsertMemory as one transaction: create a Memory with its questions,
 * or patch fields and (when given) replace every question. Throwing leaves
 * the graph unchanged. Embeddings arrive from the calling action.
 */
export const upsert = internalMutation({
  args: {
    ownerTokenIdentifier: v.string(),
    id: v.optional(v.string()),
    name: v.optional(v.string()),
    content: v.optional(v.string()),
    impression: v.optional(v.string()),
    confidence: v.optional(v.number()),
    questions: v.optional(v.array(embeddedQuestion)),
  },
  returns: v.object({
    id: v.id('memories'),
    name: v.string(),
    questionCount: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const { ownerTokenIdentifier: owner, questions, ...input } = args
    const error = upsertMemoryError({
      ...input,
      questions: questions?.map((question) => question.text),
    })
    if (error) throw new ConvexError(error)
    if (
      questions?.some(
        ({ embedding }) =>
          embedding.length !== EMBEDDING_DIMENSION ||
          !embedding.every(Number.isFinite),
      )
    )
      throw new ConvexError('Question embedding has the wrong shape')

    const now = Date.now()
    let memoryId: Id<'memories'>
    let name: string
    if (input.id === undefined) {
      // Validated above: every core field is present on create.
      name = input.name!
      memoryId = await ctx.db.insert('memories', {
        ownerTokenIdentifier: owner,
        name,
        content: input.content!,
        impression: input.impression!,
        confidence: input.confidence!,
        updatedAt: now,
      })
    } else {
      const existing = await ownedMemory(ctx, owner, input.id)
      if (!existing) throw new ConvexError('Memory not found')
      memoryId = existing._id
      const patch = Object.fromEntries(
        Object.entries({
          name: input.name,
          content: input.content,
          impression: input.impression,
          confidence: input.confidence,
        }).filter(([, value]) => value !== undefined),
      )
      await ctx.db.patch('memories', memoryId, { ...patch, updatedAt: now })
      name = input.name ?? existing.name
      if (questions) await deleteQuestions(ctx, memoryId)
    }

    for (const question of questions ?? []) {
      await ctx.db.insert('memoryQuestions', {
        ownerTokenIdentifier: owner,
        memoryId,
        text: question.text,
        embedding: question.embedding,
      })
    }
    return questions
      ? { id: memoryId, name, questionCount: questions.length }
      : { id: memoryId, name }
  },
})

/**
 * Source deleteMemories: one transaction removes each owned Memory, its
 * questions and every incident link; neighbors stay. Absent ids are no-ops.
 */
export const deleteMemories = internalMutation({
  args: { ownerTokenIdentifier: v.string(), ids: v.array(v.string()) },
  returns: v.object({
    deleted: v.array(v.object({ id: v.id('memories'), name: v.string() })),
    missingIds: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const ids = [...new Set(args.ids.map((id) => id.trim()))]
    if (ids.length === 0 || ids.some((id) => !id))
      throw new ConvexError('Provide at least one Memory id.')
    if (ids.length > MEMORY_DELETE_MAX_IDS)
      throw new ConvexError(
        `Delete at most ${MEMORY_DELETE_MAX_IDS} memories per call.`,
      )

    const deleted = []
    const missingIds = []
    for (const id of ids) {
      const memory = await ownedMemory(ctx, args.ownerTokenIdentifier, id)
      if (!memory) {
        missingIds.push(id)
        continue
      }
      await deleteQuestions(ctx, memory._id)
      await deleteIncidentLinks(ctx, memory._id)
      await ctx.db.delete('memories', memory._id)
      deleted.push({ id: memory._id, name: memory.name })
    }
    return { deleted, missingIds }
  },
})

/** Load vector hits' memories in search order, dropping deleted or foreign rows. */
export const hydrateHits = internalQuery({
  args: {
    ownerTokenIdentifier: v.string(),
    questionIds: v.array(v.id('memoryQuestions')),
  },
  returns: v.array(
    v.union(
      v.null(),
      v.object({ memoryId: v.id('memories'), name: v.string() }),
    ),
  ),
  handler: async (ctx, args) => {
    const names = new Map<Id<'memories'>, string | null>()
    const results = []
    for (const questionId of args.questionIds) {
      const question = await ctx.db.get('memoryQuestions', questionId)
      if (
        !question ||
        question.ownerTokenIdentifier !== args.ownerTokenIdentifier
      ) {
        results.push(null)
        continue
      }
      if (!names.has(question.memoryId)) {
        const memory = await ctx.db.get('memories', question.memoryId)
        names.set(
          question.memoryId,
          memory?.ownerTokenIdentifier === args.ownerTokenIdentifier
            ? memory.name
            : null,
        )
      }
      const name = names.get(question.memoryId)
      results.push(name == null ? null : { memoryId: question.memoryId, name })
    }
    return results
  },
})
