import { ConvexError } from 'convex/values'
import {
  CONE_MAX_MEMORIES,
  CONE_MAX_RELATES_TO,
  MANAGE_LINKS_MAX_ITEMS,
  TOPOLOGY_MAX_LINKS,
  TOPOLOGY_MAX_MEMORIES,
} from './policy'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { Link, LinkInput, Memory, MemoryLinkType } from './validators'

export function toMemory(doc: Doc<'memories'>): Memory {
  return {
    id: doc._id,
    name: doc.name,
    content: doc.content,
    impression: doc.impression,
    confidence: doc.confidence,
  }
}

function toLink(doc: Doc<'memoryLinks'>): Link {
  return { source: doc.source, target: doc.target, type: doc.type }
}

/** Resolve an untrusted id to one of the owner's memories, or null. */
export async function ownedMemory(
  ctx: QueryCtx,
  owner: string,
  id: string,
): Promise<Doc<'memories'> | null> {
  const memoryId = ctx.db.normalizeId('memories', id)
  if (!memoryId) return null
  const doc = await ctx.db.get('memories', memoryId)
  return doc && doc.ownerTokenIdentifier === owner ? doc : null
}

/**
 * Owner's Memory rows plus every PARENT_OF / RELATES_TO link between them.
 * Bounded; links to memories beyond the bound are omitted.
 */
export async function readTopology(ctx: QueryCtx, owner: string) {
  const memoryDocs = await ctx.db
    .query('memories')
    .withIndex('by_ownerTokenIdentifier', (q) =>
      q.eq('ownerTokenIdentifier', owner),
    )
    .take(TOPOLOGY_MAX_MEMORIES + 1)
  const linkDocs = await ctx.db
    .query('memoryLinks')
    .withIndex('by_ownerTokenIdentifier', (q) =>
      q.eq('ownerTokenIdentifier', owner),
    )
    .take(TOPOLOGY_MAX_LINKS + 1)
  const truncated =
    memoryDocs.length > TOPOLOGY_MAX_MEMORIES ||
    linkDocs.length > TOPOLOGY_MAX_LINKS
  const memories = memoryDocs.slice(0, TOPOLOGY_MAX_MEMORIES)
  const ids = new Set<Id<'memories'>>(memories.map((doc) => doc._id))
  return {
    memories,
    links: linkDocs
      .slice(0, TOPOLOGY_MAX_LINKS)
      .filter((doc) => ids.has(doc.source) && ids.has(doc.target))
      .map(toLink),
    truncated,
  }
}

function parentLinks(ctx: QueryCtx, child: Id<'memories'>) {
  return ctx.db
    .query('memoryLinks')
    .withIndex('by_target_and_type', (q) =>
      q.eq('target', child).eq('type', 'PARENT_OF'),
    )
}

function outgoing(ctx: QueryCtx, source: Id<'memories'>, type: MemoryLinkType) {
  return ctx.db
    .query('memoryLinks')
    .withIndex('by_source_and_type_and_target', (q) =>
      q.eq('source', source).eq('type', type),
    )
}

/**
 * Source `getMemoryCone`: PARENT_OF cone to `hops` generations each way and/or
 * center-incident RELATES_TO. hops never walks RELATES_TO. A visited set fuses
 * cycles; the cone stops growing at CONE_MAX_MEMORIES.
 */
export async function readCone(
  ctx: QueryCtx,
  center: Doc<'memories'>,
  hops: number,
  linkTypes: ReadonlyArray<MemoryLinkType>,
) {
  const ancestors: Array<Memory> = []
  const descendants: Array<{
    memory: Memory
    parentId: Id<'memories'>
    depth: number
  }> = []
  let relatesTo: Array<Link> = []
  let truncated = false

  if (linkTypes.includes('PARENT_OF') && hops > 0) {
    const visited = new Set<Id<'memories'>>([center._id])
    const full = () => visited.size > CONE_MAX_MEMORIES

    let current = center._id
    for (let hop = 0; hop < hops && !full(); hop++) {
      const edge = await parentLinks(ctx, current).first()
      if (!edge || visited.has(edge.source)) break
      const parent = await ctx.db.get('memories', edge.source)
      if (!parent) break
      visited.add(parent._id)
      ancestors.push(toMemory(parent))
      current = parent._id
    }

    const walk = async (parentId: Id<'memories'>, depth: number) => {
      if (depth > hops) return
      for await (const edge of outgoing(ctx, parentId, 'PARENT_OF')) {
        if (full()) {
          truncated = true
          return
        }
        if (visited.has(edge.target)) continue
        const child = await ctx.db.get('memories', edge.target)
        if (!child) continue
        visited.add(child._id)
        descendants.push({ memory: toMemory(child), parentId, depth })
        await walk(child._id, depth + 1)
      }
    }
    await walk(center._id, 1)
    if (full()) truncated = true
  }

  if (linkTypes.includes('RELATES_TO')) {
    const [out, incoming] = await Promise.all([
      outgoing(ctx, center._id, 'RELATES_TO').take(CONE_MAX_RELATES_TO + 1),
      ctx.db
        .query('memoryLinks')
        .withIndex('by_target_and_type', (q) =>
          q.eq('target', center._id).eq('type', 'RELATES_TO'),
        )
        .take(CONE_MAX_RELATES_TO + 1),
    ])
    const edges = [...out, ...incoming]
    if (edges.length > CONE_MAX_RELATES_TO) truncated = true
    relatesTo = edges.slice(0, CONE_MAX_RELATES_TO).map(toLink)
  }

  return {
    memory: toMemory(center),
    ancestors,
    descendants,
    relatesTo,
    truncated,
  }
}

async function findLink(
  ctx: QueryCtx,
  source: Id<'memories'>,
  target: Id<'memories'>,
  type: MemoryLinkType,
) {
  return await ctx.db
    .query('memoryLinks')
    .withIndex('by_source_and_type_and_target', (q) =>
      q.eq('source', source).eq('type', type).eq('target', target),
    )
    .first()
}

/**
 * Source `manageLinks`: removes, then upserts, as one transaction. Throwing
 * rolls back every earlier write in the call. Missing removes are no-ops;
 * upserts need both owned endpoints, and a child keeps at most one parent
 * unless the same call removes the old PARENT_OF first.
 */
export async function applyLinkChanges(
  ctx: MutationCtx,
  owner: string,
  remove: ReadonlyArray<LinkInput>,
  upsert: ReadonlyArray<LinkInput>,
) {
  if (
    remove.length > MANAGE_LINKS_MAX_ITEMS ||
    upsert.length > MANAGE_LINKS_MAX_ITEMS
  ) {
    throw new ConvexError(
      `Send at most ${MANAGE_LINKS_MAX_ITEMS} removes and ${MANAGE_LINKS_MAX_ITEMS} upserts per call.`,
    )
  }

  for (const item of remove) {
    const [source, target] = await Promise.all([
      ownedMemory(ctx, owner, item.source),
      ownedMemory(ctx, owner, item.target),
    ])
    if (!source || !target) continue
    const existing = await findLink(ctx, source._id, target._id, item.type)
    if (existing) await ctx.db.delete('memoryLinks', existing._id)
  }

  for (const item of upsert) {
    const [source, target] = await Promise.all([
      ownedMemory(ctx, owner, item.source),
      ownedMemory(ctx, owner, item.target),
    ])
    if (!source || !target) {
      throw new ConvexError('Link not created — source or target not found')
    }
    if (source._id === target._id) {
      throw new ConvexError('Link not created — a Memory cannot link to itself')
    }
    if (await findLink(ctx, source._id, target._id, item.type)) continue
    if (item.type === 'PARENT_OF') {
      const otherParent = await parentLinks(ctx, target._id).first()
      if (otherParent) {
        throw new ConvexError(
          'Link failed: Memory already has a PARENT_OF parent. A Memory can have at most one PARENT_OF parent.',
        )
      }
    }
    await ctx.db.insert('memoryLinks', {
      ownerTokenIdentifier: owner,
      source: source._id,
      target: target._id,
      type: item.type,
    })
  }

  const okBatch = (items: ReadonlyArray<LinkInput>) => ({
    succeeded: items.length,
    total: items.length,
    results: items.map((item) => ({ ...item, ok: true })),
  })
  return { remove: okBatch(remove), upsert: okBatch(upsert) }
}
