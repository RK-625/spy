'use node'

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { embedMany } from 'ai'
import { ConvexError, v } from 'convex/values'
import { internal } from '../_generated/api'
import { internalAction } from '../_generated/server'
import { decryptKey } from '../providers/crypto'
import {
  EMBEDDING_DIMENSION,
  MEMORY_SEARCH_MAX_DISTANCE,
  MEMORY_SEARCH_TOP_K,
} from './policy'
import { searchQuestionsError, upsertMemoryError } from './rules'
import type { ActionCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import type { UpsertMemoryInput } from './rules'

/** Source embedding model, truncated to the vector index dimension. */
const EMBEDDING_MODEL = 'gemini-embedding-2'

class EmbeddingUnavailable extends Error {}

/**
 * Embed with the owner's saved Google key; no shared-key fallback. Provider
 * bodies and credentials never leave this function.
 */
async function embedTexts(
  ctx: ActionCtx,
  owner: string,
  texts: Array<string>,
  abortSignal?: AbortSignal,
): Promise<Array<Array<number>>> {
  const encrypted = await ctx.runQuery(internal.memory.store.googleKey, {
    ownerTokenIdentifier: owner,
  })
  if (!encrypted)
    throw new EmbeddingUnavailable(
      'Memory is unavailable: add your Google embeddings key in Settings.',
    )
  const apiKey = decryptKey(encrypted, owner, 'google')
  try {
    const { embeddings } = await embedMany({
      model: createGoogleGenerativeAI({ apiKey }).embedding(EMBEDDING_MODEL),
      values: texts,
      providerOptions: {
        google: { outputDimensionality: EMBEDDING_DIMENSION },
      },
      abortSignal: abortSignal
        ? AbortSignal.any([abortSignal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
    })
    if (embeddings.some((vector) => vector.length !== EMBEDDING_DIMENSION))
      throw new Error('Unexpected embedding size')
    return embeddings
  } catch {
    throw new EmbeddingUnavailable(
      'Embedding failed. Check your Google key and quota in Settings.',
    )
  }
}

function safeMessage(error: unknown, fallback: string) {
  if (error instanceof EmbeddingUnavailable) return error.message
  if (error instanceof ConvexError && typeof error.data === 'string')
    return error.data
  return fallback
}

export type UpsertMemoryResult =
  | { id: Id<'memories'>; name: string; questionCount?: number }
  | { error: string }

/** Source upsertMemory: embed questions first, then one all-or-nothing write. */
export async function upsertMemory(
  ctx: ActionCtx,
  owner: string,
  input: UpsertMemoryInput,
  abortSignal?: AbortSignal,
): Promise<UpsertMemoryResult> {
  const invalid = upsertMemoryError(input)
  if (invalid) return { error: invalid }
  try {
    const { questions, ...fields } = input
    const embeddings = questions
      ? await embedTexts(ctx, owner, questions, abortSignal)
      : null
    return await ctx.runMutation(internal.memory.store.upsert, {
      ownerTokenIdentifier: owner,
      ...fields,
      questions: questions?.map((text, index) => ({
        text,
        embedding: embeddings![index],
      })),
    })
  } catch (error) {
    return {
      error: `upsertMemory failed (all-or-nothing); graph unchanged. ${safeMessage(error, 'Failed to upsert memory.')}`,
    }
  }
}

export type DeleteMemoriesResult =
  | {
      deleted: Array<{ id: Id<'memories'>; name: string }>
      missingIds: Array<string>
    }
  | { error: string }

/** Source deleteMemories: one write; absent ids are successful no-ops. */
export async function deleteMemories(
  ctx: ActionCtx,
  owner: string,
  ids: Array<string>,
): Promise<DeleteMemoriesResult> {
  try {
    return await ctx.runMutation(internal.memory.store.deleteMemories, {
      ownerTokenIdentifier: owner,
      ids,
    })
  } catch (error) {
    return {
      error: `deleteMemories failed; graph unchanged. ${safeMessage(error, 'Failed to delete memories.')}`,
    }
  }
}

/** Slim hit; score is cosine DISTANCE (0 = identical), matching the source. */
export type MemorySearchHit = {
  id: Id<'memories'>
  name: string
  score: number
}

export type SearchMemoriesResult =
  { results: Array<Array<MemorySearchHit>> } | { error: string }

/**
 * Source searchMemories: each question is its own ANN probe over the owner's
 * questions. Per-probe distance ceiling, best hit per Memory, no fusion.
 * results[i] belongs to questions[i].
 */
export async function searchMemories(
  ctx: ActionCtx,
  owner: string,
  questions: Array<string>,
  abortSignal?: AbortSignal,
): Promise<SearchMemoriesResult> {
  const invalid = searchQuestionsError(questions)
  if (invalid) return { error: invalid }
  try {
    const embeddings = await embedTexts(ctx, owner, questions, abortSignal)
    const probes = await Promise.all(
      embeddings.map((vector) =>
        ctx.vectorSearch('memoryQuestions', 'by_embedding', {
          vector,
          limit: MEMORY_SEARCH_TOP_K,
          filter: (q) => q.eq('ownerTokenIdentifier', owner),
        }),
      ),
    )
    const flat = probes.flat()
    const hydrated = await ctx.runQuery(internal.memory.store.hydrateHits, {
      ownerTokenIdentifier: owner,
      questionIds: flat.map((hit) => hit._id),
    })

    let offset = 0
    const results = probes.map((probe) => {
      const best = new Map<Id<'memories'>, MemorySearchHit>()
      for (const hit of probe) {
        const row = hydrated[offset++]
        const score = 1 - hit._score
        if (!row || score > MEMORY_SEARCH_MAX_DISTANCE) continue
        const prior = best.get(row.memoryId)
        if (!prior || score < prior.score)
          best.set(row.memoryId, { id: row.memoryId, name: row.name, score })
      }
      return [...best.values()]
        .sort((left, right) => left.score - right.score)
        .slice(0, MEMORY_SEARCH_TOP_K)
    })
    return { results }
  } catch (error) {
    return { error: safeMessage(error, 'Failed to search memories.') }
  }
}

/*
 * Internal entry points for the dashboard or `npx convex run`. Chat tools call
 * the helpers above directly from their own Node action.
 */

const upsertResult = v.union(
  v.object({
    id: v.id('memories'),
    name: v.string(),
    questionCount: v.optional(v.number()),
  }),
  v.object({ error: v.string() }),
)

export const upsert = internalAction({
  args: {
    ownerTokenIdentifier: v.string(),
    id: v.optional(v.string()),
    name: v.optional(v.string()),
    content: v.optional(v.string()),
    impression: v.optional(v.string()),
    confidence: v.optional(v.number()),
    questions: v.optional(v.array(v.string())),
  },
  returns: upsertResult,
  handler: async (ctx, { ownerTokenIdentifier, ...input }) =>
    await upsertMemory(ctx, ownerTokenIdentifier, input),
})

export const remove = internalAction({
  args: { ownerTokenIdentifier: v.string(), ids: v.array(v.string()) },
  returns: v.union(
    v.object({
      deleted: v.array(v.object({ id: v.id('memories'), name: v.string() })),
      missingIds: v.array(v.string()),
    }),
    v.object({ error: v.string() }),
  ),
  handler: async (ctx, args) =>
    await deleteMemories(ctx, args.ownerTokenIdentifier, args.ids),
})

export const search = internalAction({
  args: { ownerTokenIdentifier: v.string(), questions: v.array(v.string()) },
  returns: v.union(
    v.object({
      results: v.array(
        v.array(
          v.object({
            id: v.id('memories'),
            name: v.string(),
            score: v.number(),
          }),
        ),
      ),
    }),
    v.object({ error: v.string() }),
  ),
  handler: async (ctx, args) =>
    await searchMemories(ctx, args.ownerTokenIdentifier, args.questions),
})
