import type { ChatProviderId } from './providers'

/** Source workspace model choices, shared with the server without UI imports. */
export const CHAT_MODELS: Record<
  ChatProviderId,
  Array<{
    id: string
    name: string
    mode: Array<string>
    defaultMode: string
  }>
> = {
  deepseek: [
    {
      id: 'deepseek-flash',
      name: 'DeepSeek Flash',
      mode: ['high', 'max'],
      defaultMode: 'high',
    },
  ],
  meta: [
    {
      id: 'muse-spark-1.3-contributor',
      name: 'Muse Spark 1.3 Contributor',
      mode: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
      defaultMode: 'high',
    },
  ],
  openai: [
    {
      id: 'gpt-6-sol',
      name: 'GPT-6 Sol',
      mode: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
      defaultMode: 'medium',
    },
    {
      id: 'gpt-6-luna',
      name: 'GPT-6 Luna',
      mode: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
      defaultMode: 'medium',
    },
  ],
  anthropic: [
    {
      id: 'claude-opus-5-5',
      name: 'Claude Opus 5.5',
      mode: ['low', 'medium', 'high', 'xhigh', 'max'],
      defaultMode: 'medium',
    },
    {
      id: 'claude-sonnet-5-5',
      name: 'Claude Sonnet 5.5',
      mode: ['low', 'medium', 'high', 'xhigh', 'max'],
      defaultMode: 'high',
    },
  ],
  google: [
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      mode: ['low', 'medium', 'high'],
      defaultMode: 'medium',
    },
  ],
}

export function resolveChatModel(modelId: string, mode: string) {
  for (const provider of Object.keys(CHAT_MODELS) as Array<ChatProviderId>) {
    const model = CHAT_MODELS[provider].find((entry) => entry.id === modelId)
    if (model?.mode.includes(mode)) return { provider, model }
  }
  return null
}
