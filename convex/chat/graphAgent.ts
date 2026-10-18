'use node'

import { generateText, isStepCount } from 'ai'
import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { internal } from '../_generated/api'
import { decryptKey } from '../providers/crypto'
import { chatModel } from './models'
import { memoryTools } from './tools/memory'
import { graphInstructions } from './prompts/graphInstructions'
import { GRAPH_AGENT_MAX_STEPS, serializeGraphMessage } from './graphHistory'
import type { ModelMessage } from 'ai'

function parseHistory(rows: Array<string>): Array<ModelMessage> {
  const messages: Array<ModelMessage> = []
  for (const row of rows) {
    try {
      messages.push(JSON.parse(row) as ModelMessage)
    } catch {
      // Rows are validated on write; skip anything unreadable.
    }
  }
  // A bounded window must not open on tool output whose call was cut off.
  const start = messages.findIndex((message) => message.role === 'user')
  return start === -1 ? [] : messages.slice(start)
}

/**
 * Background graph maintainer for one finished chat turn. Jobs for one
 * conversation run one at a time; claim/complete hand the queue on.
 */
export const maintain = internalAction({
  args: { jobId: v.id('graphJobs') },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const context = await ctx.runMutation(internal.chat.graph.claim, { jobId })
    if (!context) return null
    let failed = false
    const controller = new AbortController()
    const deadline = setTimeout(
      () => controller.abort('Graph update timed out'),
      5 * 60 * 1000,
    )
    try {
      if (context.provider === 'exa') throw new Error('Provider unavailable')
      const apiKey = decryptKey(
        context.encrypted,
        context.ownerTokenIdentifier,
        context.provider,
      )
      const config = chatModel(
        context.provider,
        apiKey,
        context.model,
        context.mode,
      )
      const messages = parseHistory(
        await ctx.runQuery(internal.chat.graph.modelHistory, { jobId }),
      )
      if (messages.length === 0) throw new Error('Graph history unavailable')
      const tools = memoryTools(
        ctx,
        () => ctx.runQuery(internal.chat.graph.access, { jobId }),
        controller.signal,
        true,
      )
      // Source graph toolset: retrieval, upsert, delete and links only.
      delete tools.getAllMemories
      await generateText({
        model: config.model,
        providerOptions: config.providerOptions,
        instructions: graphInstructions(),
        tools,
        messages,
        stopWhen: isStepCount(GRAPH_AGENT_MAX_STEPS),
        abortSignal: controller.signal,
        // Each step's response messages stream into graph history before the next step.
        onStepEnd: async (step) => {
          const rows = step.response.messages
            .map(serializeGraphMessage)
            .filter((row): row is string => row !== null)
          if (rows.length > 0)
            await ctx.runMutation(internal.chat.graph.append, { jobId, rows })
        },
      })
      if (controller.signal.aborted) failed = true
    } catch {
      // Provider error bodies and credentials never reach history or clients.
      failed = true
    } finally {
      clearTimeout(deadline)
      await ctx.runMutation(internal.chat.graph.complete, { jobId, failed })
    }
    return null
  },
})
