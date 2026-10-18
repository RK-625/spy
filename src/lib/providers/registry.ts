/**
 * Provider registry — the single client-safe source of truth for providers and
 * their chat models. Model execution will be wired through Convex actions separately.
 */
import { PROVIDER_CAPABILITIES } from '../../../shared/providers'
import type {
  AIModel,
  ChatProviderId,
  ProviderDefinition,
  ProviderId,
} from './types'
import { Anthropic } from '~/components/brand/providers/anthropic'
import { Deepseek } from '~/components/brand/providers/deepseek'
import { Exa } from '~/components/brand/providers/exa'
import { Google } from '~/components/brand/providers/google'
import { Meta } from '~/components/brand/providers/meta'
import { Openai as OpenAI } from '~/components/brand/providers/openai'

export const providers: Array<ProviderDefinition> = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: Deepseek,
    keyPrefix: 'sk-',
    capabilities: PROVIDER_CAPABILITIES.deepseek,
    models: [
      {
        id: 'deepseek-flash',
        name: 'DeepSeek Flash',
        mode: ['high', 'max'],
        defaultMode: 'high',
      },
    ],
  },
  {
    id: 'meta',
    name: 'Meta',
    icon: Meta,
    keyPrefix: '',
    capabilities: PROVIDER_CAPABILITIES.meta,
    models: [
      {
        id: 'muse-spark-1.3-contributor',
        name: 'Muse Spark 1.3 Contributor',
        mode: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
        defaultMode: 'high',
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: OpenAI,
    keyPrefix: 'sk-',
    capabilities: PROVIDER_CAPABILITIES.openai,
    models: [
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
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: Anthropic,
    keyPrefix: 'sk-ant-',
    capabilities: PROVIDER_CAPABILITIES.anthropic,
    models: [
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
  },
  {
    id: 'google',
    name: 'Google',
    icon: Google,
    keyPrefix: 'AIza',
    capabilities: PROVIDER_CAPABILITIES.google,
    models: [
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        mode: ['low', 'medium', 'high'],
        defaultMode: 'medium',
      },
    ],
  },
  {
    id: 'exa',
    name: 'Exa',
    icon: Exa,
    keyPrefix: '',
    capabilities: PROVIDER_CAPABILITIES.exa,
    models: [],
  },
]

export function getProvider(providerId: ProviderId): ProviderDefinition {
  const provider = providers.find((entry) => entry.id === providerId)
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`)
  }
  return provider
}

function isChatProvider(
  provider: ProviderDefinition,
): provider is ProviderDefinition & { id: ChatProviderId } {
  return provider.id !== 'exa'
}

export const models: Array<AIModel> = providers
  .filter(isChatProvider)
  .flatMap((provider) =>
    provider.models.map((model) => ({
      ...model,
      chef: provider.name,
      chefSlug: provider.id,
      icon: provider.icon,
    })),
  )

/** Providers with at least one chat model, in registry order (model picker groups). */
export const chefs: Array<string> = providers
  .filter((provider) => provider.models.length > 0)
  .map((provider) => provider.name)
