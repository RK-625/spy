import { ConvexError, v } from 'convex/values'
import { internalMutation, internalQuery } from '../_generated/server'
import { applyLinkChanges, ownedMemory, readCone, readTopology } from './graph'
import { MEMORY_GET_MAX_REQUESTS } from './policy'
import {
  link,
  linkBatch,
  linkInput,
  memoryCone,
  memoryLinkType,
  memoryListItem,
} from './validators'

/**
 * Source `getMemories`: independent cone lookups in request order. Owner comes
 * from the calling tool's conversation, never from model input.
 */
export const getMemories = internalQuery({
  args: {
    ownerTokenIdentifier: v.string(),
    requests: v.array(
      v.object({
        id: v.string(),
        hops: v.optional(v.number()),
        linkTypes: v.array(memoryLinkType),
      }),
    ),
  },
  returns: v.array(
    v.union(
      v.object({ id: v.string(), ok: v.literal(true), cone: memoryCone }),
      v.object({ id: v.string(), ok: v.literal(false), error: v.string() }),
    ),
  ),
  handler: async (ctx, args) => {
    if (
      args.requests.length === 0 ||
      args.requests.length > MEMORY_GET_MAX_REQUESTS
    ) {
      throw new ConvexError(
        `Request between 1 and ${MEMORY_GET_MAX_REQUESTS} memories.`,
      )
    }
    const results = []
    for (const request of args.requests) {
      const hops = request.hops ?? 0
      if (!Number.isInteger(hops) || hops < 0) {
        results.push({
          id: request.id,
          ok: false as const,
          error: 'hops must be a non-negative integer',
        })
        continue
      }
      if (request.linkTypes.length === 0) {
        results.push({
          id: request.id,
          ok: false as const,
          error: 'linkTypes needs PARENT_OF and/or RELATES_TO',
        })
        continue
      }
      const center = await ownedMemory(
        ctx,
        args.ownerTokenIdentifier,
        request.id,
      )
      if (!center) {
        results.push({
          id: request.id,
          ok: false as const,
          error: 'Memory not found',
        })
        continue
      }
      results.push({
        id: request.id,
        ok: true as const,
        cone: await readCone(ctx, center, hops, request.linkTypes),
      })
    }
    return results
  },
})

/** Source `getAllMemories` listing: lean rows plus every link. */
export const listing = internalQuery({
  args: { ownerTokenIdentifier: v.string() },
  returns: v.object({
    memories: v.array(memoryListItem),
    links: v.array(link),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { memories, links, truncated } = await readTopology(
      ctx,
      args.ownerTokenIdentifier,
    )
    return {
      memories: memories.map((doc) => ({
        id: doc._id,
        name: doc.name,
        confidence: doc.confidence,
      })),
      links,
      truncated,
    }
  },
})

/** Source `manageLinks`: one all-or-nothing remove-then-upsert transaction. */
export const manageLinks = internalMutation({
  args: {
    ownerTokenIdentifier: v.string(),
    remove: v.array(linkInput),
    upsert: v.array(linkInput),
  },
  returns: v.object({ remove: linkBatch, upsert: linkBatch }),
  handler: async (ctx, args) =>
    await applyLinkChanges(
      ctx,
      args.ownerTokenIdentifier,
      args.remove,
      args.upsert,
    ),
})
