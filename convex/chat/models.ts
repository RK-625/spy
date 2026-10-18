'use node'

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createDeepSeek } from '@ai-sdk/deepseek'
import type { LanguageModelV4, SharedV4ProviderOptions } from '@ai-sdk/provider'
import type {} from '../../shared/ai-model-types'
import type { ChatProviderId } from '../../shared/providers'

/** Source model routing. Always supplied a decrypted, user-owned credential by the worker. */
export function chatModel(
  provider: ChatProviderId,
  apiKey: string,
  modelId: string,
  mode: string,
): {
  model: LanguageModelV4
  providerOptions: SharedV4ProviderOptions
} {
  switch (provider) {
    case 'openai':
      return {
        model: createOpenAI({ apiKey })(modelId),
        providerOptions: { openai: { reasoningEffort: mode } },
      }
    case 'anthropic':
      return {
        model: createAnthropic({ apiKey })(modelId),
        providerOptions: { anthropic: { effort: mode } },
      }
    case 'google':
      return {
        model: createGoogleGenerativeAI({ apiKey })(modelId),
        providerOptions: {
          google: { thinkingConfig: { thinkingLevel: mode } },
        },
      }
    case 'deepseek':
      return {
        model: createDeepSeek({ apiKey })(modelId),
        providerOptions: { deepseek: { reasoningEffort: mode } },
      }
    case 'meta':
      return {
        model: createOpenAI({
          name: 'meta',
          baseURL: 'https://api.meta.ai/v1',
          apiKey,
        })(modelId),
        providerOptions: {
          openai: {
            forceReasoning: true,
            include: ['reasoning.encrypted_content'],
            reasoningEffort: mode,
          },
        },
      }
  }
}
