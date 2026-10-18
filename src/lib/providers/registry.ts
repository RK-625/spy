/**
 * Provider registry — the single client-safe source of truth for providers and
 * their chat models. Model execution will be wired through Convex actions separately.
 */
import { CHAT_MODELS } from '../../../shared/models'
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
    models: CHAT_MODELS.deepseek,
  },
  {
    id: 'meta',
    name: 'Meta',
    icon: Meta,
    keyPrefix: '',
    capabilities: PROVIDER_CAPABILITIES.meta,
    models: CHAT_MODELS.meta,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: OpenAI,
    keyPrefix: 'sk-',
    capabilities: PROVIDER_CAPABILITIES.openai,
    models: CHAT_MODELS.openai,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: Anthropic,
    keyPrefix: 'sk-ant-',
    capabilities: PROVIDER_CAPABILITIES.anthropic,
    models: CHAT_MODELS.anthropic,
  },
  {
    id: 'google',
    name: 'Google',
    icon: Google,
    keyPrefix: 'AIza',
    capabilities: PROVIDER_CAPABILITIES.google,
    models: CHAT_MODELS.google,
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
