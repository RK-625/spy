'use node'

import { Agent } from '@convex-dev/agent'
import { isStepCount } from 'ai'
import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { components, internal } from '../_generated/api'
import { decryptKey } from '../providers/crypto'
import { chatModel } from './models'
import { webSearchTool } from './tools/search'
import { askUserQuestion } from './tools/question'
import { memoryTools } from './tools/memory'
import { chatInstructions } from './prompts/instructions'
import type { ToolSet } from 'ai'
import type { Id } from '../_generated/dataModel'

export const reply = internalAction({
  args: { conversationId: v.id('conversations'), requestId: v.string() },
  returns: v.null(),
  handler: async (
    ctx,
    args: { conversationId: Id<'conversations'>; requestId: string },
  ) => {
    if (!(await ctx.runMutation(internal.chat.runtime.begin, args))) return null
    let failed = false
    const controller = new AbortController()
    const deadline = setTimeout(
      () => controller.abort('Response timed out'),
      4 * 60 * 1000,
    )
    try {
      const context = await ctx.runQuery(internal.chat.runtime.context, args)
      if (!context || context.provider === 'exa')
        throw new Error('Provider unavailable')
      const apiKey = decryptKey(
        context.encrypted,
        context.ownerTokenIdentifier,
        context.provider,
      )
      const config = chatModel(
        context.provider,
        apiKey,
        context.turn.model,
        context.turn.mode,
      )
      const searchEnabled = Boolean(
        context.turn.useWebSearch &&
        (await ctx.runQuery(internal.chat.runtime.webSearchKey, args)),
      )
      const buildMode = context.turn.useBuildMode === true
      const tools: ToolSet = {
        ...memoryTools(ctx, args, controller.signal, buildMode),
        askUserQuestion,
      }
      if (searchEnabled)
        tools.webSearch = webSearchTool(ctx, args, controller.signal)
      const options = {
        name: 'Spy',
        languageModel: config.model,
        instructions: chatInstructions({ buildMode, webSearch: searchEnabled }),
        contextOptions: { recentMessages: 100 },
        tools,
      }
      const agent = new Agent<object, typeof tools>(components.agent, options)
      // Re-check cancellation before model invocation and on the first streamed chunk.
      // This covers a stop committed while the Agent is still loading history.
      let checkedAt = 0
      async function checkStop() {
        if (!(await ctx.runQuery(internal.chat.runtime.running, args)))
          controller.abort('Stopped')
        checkedAt = Date.now()
      }
      await agent.streamText(
        ctx,
        { threadId: context.threadId, userId: context.ownerTokenIdentifier },
        {
          promptMessageId: context.turn.promptMessageId,
          providerOptions: config.providerOptions,
          abortSignal: controller.signal,
          maxRetries: 0,
          // Source budgets: web search or build mode need room for retrieval and writes.
          stopWhen: isStepCount(searchEnabled || buildMode ? 25 : 8),
          prepareStep: async () => {
            await checkStop()
          },
          onChunk: async () => {
            if (Date.now() - checkedAt > 1000) await checkStop()
          },
          onError: () => {
            failed = true
          },
        },
        { saveStreamDeltas: { throttleMs: 150, sendSources: true } },
      )
      if (controller.signal.aborted) failed = true
    } catch {
      // Never expose provider error bodies or decrypted credentials to clients.
      failed = true
    } finally {
      clearTimeout(deadline)
      await ctx.runMutation(internal.chat.runtime.finish, { ...args, failed })
    }
    return null
  },
})
