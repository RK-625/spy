'use node'

/**
 * Source `/api/mcp-apps` app-visible tool calls, as an authenticated action.
 * The sandboxed app reaches this only through the host bridge; the server
 * re-checks app visibility and never forwards user credentials.
 */

import { ConvexError, v } from 'convex/values'
import { action } from '../_generated/server'
import { requireKeyOwner } from '../providers/identity'
import { AppToolDeniedError, callExcalidrawAppTool } from './excalidraw'

const MAX_ARGUMENT_CHARS = 256_000
const MAX_RESULT_CHARS = 4_000_000

/** Returns the MCP result as JSON text: MCP `_meta` keys are not Convex object keys. */
export const call = action({
  args: { name: v.string(), arguments: v.optional(v.string()) },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireKeyOwner(ctx)
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(args.name))
      throw new ConvexError('This diagram action isn’t available.')
    if ((args.arguments?.length ?? 0) > MAX_ARGUMENT_CHARS)
      throw new ConvexError('This diagram action is too large.')
    let input: unknown = {}
    try {
      input = args.arguments ? JSON.parse(args.arguments) : {}
    } catch {
      throw new ConvexError('This diagram action is invalid.')
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input))
      throw new ConvexError('This diagram action is invalid.')
    let result: unknown
    try {
      result = await callExcalidrawAppTool(
        args.name,
        input as Record<string, unknown>,
      )
    } catch (error) {
      if (error instanceof AppToolDeniedError)
        throw new ConvexError('This diagram action isn’t available.')
      throw new ConvexError('Couldn’t reach Excalidraw. Try again.')
    }
    const json = JSON.stringify(result ?? {})
    if (json.length > MAX_RESULT_CHARS)
      throw new ConvexError('The diagram response was too large.')
    return json
  },
})
