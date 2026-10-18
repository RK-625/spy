/** Provider identity/capabilities shared by the browser and Convex. No secrets. */
export const PROVIDER_IDS = [
  'deepseek',
  'meta',
  'openai',
  'anthropic',
  'google',
  'exa',
] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]
export type ChatProviderId = Exclude<ProviderId, 'exa'>
export type ProviderCapability = 'chat' | 'embeddings' | 'webSearch'

export const PROVIDER_CAPABILITIES: Record<
  ProviderId,
  Array<ProviderCapability>
> = {
  deepseek: ['chat'],
  meta: ['chat'],
  openai: ['chat'],
  anthropic: ['chat'],
  google: ['chat', 'embeddings'],
  exa: ['webSearch'],
}

export function getKeyRequirements(savedProviders: ReadonlyArray<ProviderId>) {
  const hasEmbeddings = savedProviders.includes('google')
  const hasChatProvider = savedProviders.some((id) =>
    PROVIDER_CAPABILITIES[id].includes('chat'),
  )
  return {
    hasEmbeddings,
    hasChatProvider,
    ready: hasEmbeddings && hasChatProvider,
  }
}
