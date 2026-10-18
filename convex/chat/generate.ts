'use node'

import { Agent } from '@convex-dev/agent'
import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { components, internal } from '../_generated/api'
import { decryptKey } from '../providers/crypto'
import { chatModel } from './models'
import type { Id } from '../_generated/dataModel'

// The source tutor role; tool/graph instructions are added with those capabilities.
const INSTRUCTIONS = `Your name is Spy — a personal tutor, guide, mentor and sounding board.
Help the user explore concepts, questions, doubts and puzzles in any domain.
Match their energy and knowledge. Explain through their perspective, ground ideas in useful analogies,
challenge gently and connect learnings. Be direct and useful in the current turn.
Only claim to search, retrieve notes or create artifacts when tools for that capability are available.`

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
      const options = {
        name: 'Spy',
        languageModel: config.model,
        instructions: INSTRUCTIONS,
        contextOptions: { recentMessages: 100 },
      }
      const agent = new Agent<object, Record<string, never>>(
        components.agent,
        options,
      )
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
