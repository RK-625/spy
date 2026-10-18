import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import {
  listMessages,
  syncStreams,
  vStreamArgs,
  vStreamMessagesReturnValue,
} from '@convex-dev/agent'
import { query } from '../_generated/server'
import { components } from '../_generated/api'
import { requireThread } from './ownership'

export const list = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  returns: vStreamMessagesReturnValue,
  handler: async (ctx, args) => {
    await requireThread(ctx, args.threadId)
    const page = await listMessages(ctx, components.agent, args)
    const streams = await syncStreams(ctx, components.agent, args)
    // Provider error bodies belong in server diagnostics, never in browser state.
    const safeStreams =
      streams?.kind === 'deltas'
        ? {
            ...streams,
            deltas: streams.deltas.map((delta) => ({
              ...delta,
              parts: delta.parts.map((part: unknown) =>
                part &&
                typeof part === 'object' &&
                'type' in part &&
                part.type === 'error'
                  ? {
                      type: 'error',
                      errorText: 'Couldn’t complete this response.',
                    }
                  : part,
              ),
            })),
          }
        : streams
    return {
      ...page,
      page: page.page.map((message) => ({
        ...message,
        error: message.error ? 'Couldn’t complete this response.' : undefined,
      })),
      streams: safeStreams,
    }
  },
})
