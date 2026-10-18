'use node'

import { jsonSchema, tool } from 'ai'
import { ConvexError } from 'convex/values'
import { internal } from '../../_generated/api'
import {
  deleteMemories,
  searchMemories,
  upsertMemory,
} from '../../memory/actions'
import {
  MEMORY_GET_MAX_REQUESTS,
  MEMORY_QUESTION_COUNT_MAX,
  MEMORY_QUESTION_COUNT_MIN,
  MEMORY_SEARCH_MAX_QUESTIONS,
} from '../../memory/policy'
import { buildNotesForest } from '../../../shared/notes/hierarchy'
import {
  deleteMemoriesIdsFieldDescription,
  deleteMemoriesToolDescription,
} from '../prompts/deleteMemories'
import {
  getAllMemoriesToolDescription,
  getMemoriesHopsFieldDescription,
  getMemoriesIdFieldDescription,
  getMemoriesLinkTypesFieldDescription,
  getMemoriesMemoriesFieldDescription,
  getMemoriesToolDescription,
} from '../prompts/getMemories'
import {
  manageLinksRemoveFieldDescription,
  manageLinksToolDescription,
  manageLinksUpsertFieldDescription,
} from '../prompts/manageLinks'
import {
  searchMemoriesQuestionsFieldDescription,
  searchMemoriesToolDescription,
} from '../prompts/searchMemories'
import {
  upsertMemoryConfidenceFieldDescription,
  upsertMemoryContentFieldDescription,
  upsertMemoryIdFieldDescription,
  upsertMemoryImpressionFieldDescription,
  upsertMemoryNameFieldDescription,
  upsertMemoryQuestionsFieldDescription,
  upsertMemoryToolDescription,
} from '../prompts/upsertMemory'
import type { JSONSchema7, ToolSet } from 'ai'
import type { ActionCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'
import type { UpsertMemoryInput } from '../../memory/rules'
import type { LinkInput, Memory, MemoryLinkType } from '../../memory/validators'

type Turn = { conversationId: Id<'conversations'>; requestId: string }

const UNAVAILABLE = { error: 'Memory tools are unavailable for this turn.' }
const BUILD_ONLY = {
  error: 'Graph writes need build mode. Ask the user to enable build mode.',
}

type Validation<T> =
  { success: true; value: T } | { success: false; error: Error }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): value is Array<string> {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function onlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}

function fail<T>(message: string): Validation<T> {
  return { success: false, error: new Error(message) }
}

function linkType(value: unknown): value is MemoryLinkType {
  return value === 'PARENT_OF' || value === 'RELATES_TO'
}

function links(value: unknown): Array<LinkInput> | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  const parsed: Array<LinkInput> = []
  for (const item of value) {
    if (
      !record(item) ||
      !onlyKeys(item, ['source', 'target', 'type']) ||
      typeof item.source !== 'string' ||
      typeof item.target !== 'string' ||
      !linkType(item.type)
    )
      return null
    parsed.push({ source: item.source, target: item.target, type: item.type })
  }
  return parsed
}

const linkItemSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    source: { type: 'string', description: 'The ID of the source node' },
    target: { type: 'string', description: 'The ID of the target node' },
    type: {
      type: 'string',
      enum: ['PARENT_OF', 'RELATES_TO'],
      description: 'PARENT_OF: parent → child. RELATES_TO: association.',
    },
  },
  required: ['source', 'target', 'type'],
  additionalProperties: false,
}

/** Source nested descendants, rebuilt from the flat validated cone. */
type MemoryChild = { memory: Memory; children: Array<MemoryChild> }

function nest(
  centerId: string,
  flat: Array<{ memory: Memory; parentId: string }>,
): Array<MemoryChild> {
  const byParent = new Map<string, Array<MemoryChild>>()
  const nodes = flat.map((entry) => {
    const node: MemoryChild = { memory: entry.memory, children: [] }
    const siblings = byParent.get(entry.parentId)
    if (siblings) siblings.push(node)
    else byParent.set(entry.parentId, [node])
    return node
  })
  for (const node of nodes) node.children = byParent.get(node.memory.id) ?? []
  return byParent.get(centerId) ?? []
}

function errorText(error: unknown, fallback: string) {
  return error instanceof ConvexError && typeof error.data === 'string'
    ? error.data
    : fallback
}

/**
 * Source product memory tools. Retrieval is always on; writes register only
 * in build mode and recheck the stored turn on every call.
 */
export function memoryTools(
  ctx: ActionCtx,
  turn: Turn,
  signal: AbortSignal,
  buildMode: boolean,
): ToolSet {
  const access = () => ctx.runQuery(internal.chat.runtime.memoryAccess, turn)

  const tools: ToolSet = {
    searchMemories: tool({
      description: searchMemoriesToolDescription,
      inputSchema: jsonSchema<{ questions: Array<string> }>(
        {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              minItems: 1,
              maxItems: MEMORY_SEARCH_MAX_QUESTIONS,
              items: { type: 'string', minLength: 1 },
              description: searchMemoriesQuestionsFieldDescription,
            },
          },
          required: ['questions'],
          additionalProperties: false,
        },
        {
          validate(value) {
            return record(value) &&
              onlyKeys(value, ['questions']) &&
              strings(value.questions)
              ? { success: true, value: { questions: value.questions } }
              : fail(
                  `Pass questions: 1–${MEMORY_SEARCH_MAX_QUESTIONS} strings.`,
                )
          },
        },
      ),
      execute: async ({ questions }) => {
        const owner = await access()
        if (!owner || signal.aborted) return UNAVAILABLE
        return await searchMemories(
          ctx,
          owner.ownerTokenIdentifier,
          questions,
          signal,
        )
      },
    }),

    getMemories: tool({
      description: getMemoriesToolDescription,
      inputSchema: jsonSchema<{
        memories: Array<{
          id: string
          hops?: number
          linkTypes: Array<MemoryLinkType>
        }>
      }>(
        {
          type: 'object',
          properties: {
            memories: {
              type: 'array',
              minItems: 1,
              maxItems: MEMORY_GET_MAX_REQUESTS,
              description: getMemoriesMemoriesFieldDescription,
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    minLength: 1,
                    description: getMemoriesIdFieldDescription,
                  },
                  hops: {
                    type: 'integer',
                    minimum: 0,
                    description: getMemoriesHopsFieldDescription,
                  },
                  linkTypes: {
                    type: 'array',
                    minItems: 1,
                    items: {
                      type: 'string',
                      enum: ['PARENT_OF', 'RELATES_TO'],
                    },
                    description: getMemoriesLinkTypesFieldDescription,
                  },
                },
                required: ['id', 'linkTypes'],
                additionalProperties: false,
              },
            },
          },
          required: ['memories'],
          additionalProperties: false,
        },
        {
          validate(value) {
            const message = `Pass memories: 1–${MEMORY_GET_MAX_REQUESTS} objects with id, optional hops and linkTypes.`
            if (
              !record(value) ||
              !onlyKeys(value, ['memories']) ||
              !Array.isArray(value.memories) ||
              value.memories.length === 0 ||
              value.memories.length > MEMORY_GET_MAX_REQUESTS
            )
              return fail(message)
            const memories = []
            for (const item of value.memories as Array<unknown>) {
              if (
                !record(item) ||
                !onlyKeys(item, ['id', 'hops', 'linkTypes']) ||
                typeof item.id !== 'string' ||
                !item.id ||
                (item.hops !== undefined &&
                  !(
                    typeof item.hops === 'number' &&
                    Number.isInteger(item.hops) &&
                    item.hops >= 0
                  )) ||
                !Array.isArray(item.linkTypes) ||
                item.linkTypes.length === 0 ||
                !item.linkTypes.every(linkType)
              )
                return fail(message)
              memories.push({
                id: item.id,
                hops: item.hops,
                linkTypes: item.linkTypes,
              })
            }
            return { success: true, value: { memories } }
          },
        },
      ),
      execute: async ({ memories }) => {
        const owner = await access()
        if (!owner || signal.aborted) return UNAVAILABLE
        try {
          const results = await ctx.runQuery(
            internal.memory.links.getMemories,
            {
              ownerTokenIdentifier: owner.ownerTokenIdentifier,
              requests: memories,
            },
          )
          return {
            results: results.map((result) =>
              result.ok
                ? {
                    id: result.id,
                    ok: true,
                    memory: result.cone.memory,
                    ancestors: result.cone.ancestors,
                    descendants: nest(
                      result.cone.memory.id,
                      result.cone.descendants,
                    ),
                    relatesTo: result.cone.relatesTo,
                    ...(result.cone.truncated ? { truncated: true } : {}),
                  }
                : result,
            ),
          }
        } catch (error) {
          return { error: errorText(error, 'Failed to get memories.') }
        }
      },
    }),
  }

  if (!buildMode) return tools

  /** Owner for a write, or the safe result to return instead. */
  async function writer() {
    const owner = await access()
    if (!owner || signal.aborted) return { blocked: UNAVAILABLE }
    if (!owner.buildMode) return { blocked: BUILD_ONLY }
    return { owner: owner.ownerTokenIdentifier }
  }

  tools.getAllMemories = tool({
    description: getAllMemoriesToolDescription,
    inputSchema: jsonSchema<Record<string, never>>(
      { type: 'object', properties: {}, additionalProperties: false },
      {
        validate(value) {
          return record(value) && Object.keys(value).length === 0
            ? { success: true, value: {} }
            : fail('getAllMemories takes no arguments.')
        },
      },
    ),
    execute: async () => {
      const owner = await access()
      if (!owner || signal.aborted) return UNAVAILABLE
      try {
        const listing = await ctx.runQuery(internal.memory.links.listing, {
          ownerTokenIdentifier: owner.ownerTokenIdentifier,
        })
        return {
          tree: buildNotesForest(listing.memories, listing.links),
          relatesTo: listing.links
            .filter((link) => link.type === 'RELATES_TO')
            .map(({ source, target }) => ({ source, target })),
          ...(listing.truncated ? { truncated: true } : {}),
        }
      } catch (error) {
        return { error: errorText(error, 'Failed to list memories.') }
      }
    },
  })

  tools.upsertMemory = tool({
    description: upsertMemoryToolDescription,
    inputSchema: jsonSchema<UpsertMemoryInput>(
      {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            minLength: 1,
            description: upsertMemoryIdFieldDescription,
          },
          name: {
            type: 'string',
            minLength: 1,
            description: upsertMemoryNameFieldDescription,
          },
          content: {
            type: 'string',
            minLength: 1,
            description: upsertMemoryContentFieldDescription,
          },
          impression: {
            type: 'string',
            description: upsertMemoryImpressionFieldDescription,
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: upsertMemoryConfidenceFieldDescription,
          },
          questions: {
            type: 'array',
            minItems: MEMORY_QUESTION_COUNT_MIN,
            maxItems: MEMORY_QUESTION_COUNT_MAX,
            items: { type: 'string', minLength: 1, maxLength: 500 },
            description: upsertMemoryQuestionsFieldDescription,
          },
        },
        additionalProperties: false,
      },
      {
        validate(value) {
          const keys = ['id', 'name', 'content', 'impression', 'confidence']
          if (
            !record(value) ||
            !onlyKeys(value, [...keys, 'questions']) ||
            keys.some(
              (key) =>
                value[key] !== undefined &&
                typeof value[key] !==
                  (key === 'confidence' ? 'number' : 'string'),
            ) ||
            (value.questions !== undefined && !strings(value.questions))
          )
            return fail(
              'Pass upsertMemory fields as strings, confidence as a number and questions as strings.',
            )
          return { success: true, value: value }
        },
      },
    ),
    execute: async (input) => {
      const gate = await writer()
      if ('blocked' in gate) return gate.blocked
      return await upsertMemory(ctx, gate.owner, input, signal)
    },
  })

  tools.deleteMemories = tool({
    description: deleteMemoriesToolDescription,
    inputSchema: jsonSchema<{ ids: Array<string> }>(
      {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', minLength: 1 },
            description: deleteMemoriesIdsFieldDescription,
          },
        },
        required: ['ids'],
        additionalProperties: false,
      },
      {
        validate(value) {
          return record(value) &&
            onlyKeys(value, ['ids']) &&
            strings(value.ids) &&
            value.ids.length > 0
            ? { success: true, value: { ids: value.ids } }
            : fail('Pass ids: a non-empty array of Memory ids.')
        },
      },
    ),
    execute: async ({ ids }) => {
      const gate = await writer()
      if ('blocked' in gate) return gate.blocked
      return await deleteMemories(ctx, gate.owner, ids)
    },
  })

  tools.manageLinks = tool({
    description: manageLinksToolDescription,
    inputSchema: jsonSchema<{
      remove: Array<LinkInput>
      upsert: Array<LinkInput>
    }>(
      {
        type: 'object',
        properties: {
          remove: {
            type: 'array',
            items: linkItemSchema,
            description: manageLinksRemoveFieldDescription,
          },
          upsert: {
            type: 'array',
            items: linkItemSchema,
            description: manageLinksUpsertFieldDescription,
          },
        },
        additionalProperties: false,
      },
      {
        validate(value) {
          if (!record(value) || !onlyKeys(value, ['remove', 'upsert']))
            return fail('Pass remove and/or upsert link arrays.')
          const remove = links(value.remove)
          const upsert = links(value.upsert)
          return remove && upsert
            ? { success: true, value: { remove, upsert } }
            : fail('Each link needs source, target and type.')
        },
      },
    ),
    execute: async ({ remove, upsert }) => {
      const gate = await writer()
      if ('blocked' in gate) return gate.blocked
      try {
        return await ctx.runMutation(internal.memory.links.manageLinks, {
          ownerTokenIdentifier: gate.owner,
          remove,
          upsert,
        })
      } catch (error) {
        return {
          error: `manageLinks failed (all-or-nothing); graph unchanged. ${errorText(error, 'Failed to manage links.')}`,
        }
      }
    },
  })

  return tools
}
