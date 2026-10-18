'use node'

import { jsonSchema, tool } from 'ai'
import { internal } from '../../_generated/api'
import { decryptKey } from '../../providers/crypto'
import type { ActionCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'

const inputSchema = jsonSchema<{ query: string }>(
  {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        minLength: 1,
        maxLength: 2000,
        description: 'Keywords or a short natural-language phrase to look up.',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  {
    validate(value) {
      if (
        value &&
        typeof value === 'object' &&
        'query' in value &&
        typeof value.query === 'string' &&
        value.query.trim().length > 0 &&
        value.query.length <= 2000 &&
        Object.keys(value).length === 1
      )
        return { success: true, value: { query: value.query } }
      return {
        success: false,
        error: new Error('Enter a search query under 2,000 characters.'),
      }
    },
  },
)

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Only safe, bounded source fields enter the persisted tool result. */
function resultsFrom(value: unknown) {
  if (!record(value) || !Array.isArray(value.results))
    throw new Error('Invalid search response')
  return value.results.slice(0, 5).flatMap((result: unknown) => {
    if (
      !record(result) ||
      typeof result.url !== 'string' ||
      result.url.length > 8192
    )
      return []
    let url: URL
    try {
      url = new URL(result.url)
    } catch {
      return []
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return []
    return [
      {
        title:
          typeof result.title === 'string'
            ? result.title.slice(0, 1000)
            : 'Undefined',
        url: url.href,
        text: typeof result.text === 'string' ? result.text.slice(0, 5000) : '',
      },
    ]
  })
}

async function readResponse(response: Response) {
  if (!response.body) throw new Error('Empty search response')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let size = 0
  try {
    for (;;) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > 1_000_000) throw new Error('Search response too large')
      text += decoder.decode(part.value, { stream: true })
    }
    text += decoder.decode()
    const value: unknown = JSON.parse(text)
    return resultsFrom(value)
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export function webSearchTool(
  ctx: ActionCtx,
  turn: { conversationId: Id<'conversations'>; requestId: string },
  signal: AbortSignal,
) {
  return tool({
    description:
      'Search the web for current facts, news, articles, sources, and details.',
    inputSchema,
    execute: async ({ query }, options) => {
      try {
        const key = await ctx.runQuery(internal.chat.runtime.webSearchKey, turn)
        if (!key || signal.aborted)
          return {
            error:
              'Web search is unavailable: add an Exa key in Settings or enable web search for your next message.',
          }
        const apiKey = decryptKey(
          key.encrypted,
          key.ownerTokenIdentifier,
          'exa',
        )
        const response = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            numResults: 5,
            contents: { text: { maxCharacters: 5000 } },
          }),
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(25_000),
            ...(options.abortSignal ? [options.abortSignal] : []),
          ]),
          redirect: 'error',
          cache: 'no-store',
        })
        if (!response.ok) {
          await response.body?.cancel()
          return {
            error:
              'Failed to retrieve search results. Check your Exa key and available credits in Settings.',
          }
        }
        return { results: await readResponse(response) }
      } catch {
        // Provider error bodies and credentials must never enter Agent history or logs.
        return { error: 'Failed to retrieve search results.' }
      }
    },
  })
}
