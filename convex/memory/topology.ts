import { v } from 'convex/values'
import { query } from '../_generated/server'
import { requireKeyOwner } from '../providers/identity'
import { ownedMemory, readTopology, toMemory } from './graph'
import { memory, topology } from './validators'

/**
 * The signed-in user's Memory graph for Notes and the graph canvas. Reactive:
 * writes from memory tools re-run it, replacing the source topology feed.
 */
export const get = query({
  args: {},
  returns: topology,
  handler: async (ctx) => {
    const owner = await requireKeyOwner(ctx)
    const { memories, links, truncated } = await readTopology(ctx, owner)
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

/** One owned Memory's full body for note detail and node inspection. */
export const memoryById = query({
  args: { id: v.string() },
  returns: v.union(memory, v.null()),
  handler: async (ctx, args) => {
    const owner = await requireKeyOwner(ctx)
    const doc = await ownedMemory(ctx, owner, args.id)
    return doc ? toMemory(doc) : null
  },
})
