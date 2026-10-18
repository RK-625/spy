import { v } from 'convex/values'
import type { Infer } from 'convex/values'

/** Hierarchical PARENT_OF (parent → child) or associative RELATES_TO. */
export const memoryLinkType = v.union(
  v.literal('PARENT_OF'),
  v.literal('RELATES_TO'),
)
export type MemoryLinkType = Infer<typeof memoryLinkType>

/** Source Memory core fields. Embeddings live on memoryQuestions, never here. */
export const memoryFields = {
  name: v.string(),
  content: v.string(),
  impression: v.string(),
  confidence: v.number(),
}

/** Product Memory row; `id` is the Convex document ID. */
export const memory = v.object({
  id: v.id('memories'),
  ...memoryFields,
})
export type Memory = Infer<typeof memory>

/** Lean listing row for the Notes forest and graph canvas. */
export const memoryListItem = v.object({
  id: v.id('memories'),
  name: v.string(),
  confidence: v.number(),
})

export const link = v.object({
  source: v.id('memories'),
  target: v.id('memories'),
  type: memoryLinkType,
})
export type Link = Infer<typeof link>

/** Model-authored edge: endpoints are untrusted strings until normalized. */
export const linkInput = v.object({
  source: v.string(),
  target: v.string(),
  type: memoryLinkType,
})
export type LinkInput = Infer<typeof linkInput>

export const topology = v.object({
  memories: v.array(memoryListItem),
  links: v.array(link),
  /** True when the owner's graph exceeds the bounded read. */
  truncated: v.boolean(),
})

/**
 * Descendants in depth-first source order. The source nests children; nesting
 * by `parentId` happens at the tool boundary because validators cannot recurse.
 */
const memoryDescendant = v.object({
  memory,
  parentId: v.id('memories'),
  depth: v.number(),
})

/** PARENT_OF cone (ancestors up, descendants down) plus center RELATES_TO. */
export const memoryCone = v.object({
  memory,
  ancestors: v.array(memory),
  descendants: v.array(memoryDescendant),
  relatesTo: v.array(link),
  truncated: v.boolean(),
})

const batchItem = v.object({
  source: v.string(),
  target: v.string(),
  type: memoryLinkType,
  ok: v.boolean(),
})

export const linkBatch = v.object({
  succeeded: v.number(),
  total: v.number(),
  results: v.array(batchItem),
})
