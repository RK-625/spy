import type React from 'react'
import type {
  ChatProviderId,
  ProviderCapability,
  ProviderId,
} from '../../../shared/providers'

export type Chef = string
export type ModelId = string

export type {
  ProviderId,
  ChatProviderId,
  ProviderCapability,
} from '../../../shared/providers'

export type ProviderIcon = React.FunctionComponent<
  React.SVGProps<SVGSVGElement>
>

/** A chat model as declared inside its provider's registry entry. */
export interface ProviderModel {
  id: ModelId
  name: string
  mode: Array<string>
  defaultMode: string
}

export interface ProviderDefinition {
  id: ProviderId
  name: Chef
  icon: ProviderIcon
  /** Known key prefix, shown in the paste placeholder and the masked hint. */
  keyPrefix: string
  capabilities: Array<ProviderCapability>
  models: Array<ProviderModel>
}

/** Saved keys were verified on save; only the last 4 characters leave the server. */
export interface ProviderKeyStatus {
  id: ProviderId
  keyHint: string | null
}

/** A chat model flattened with its provider, as the model picker consumes it. */
export interface AIModel extends ProviderModel {
  chef: Chef
  chefSlug: ChatProviderId
  icon: ProviderIcon
}

export type ProviderKeyHints = Partial<Record<ProviderId, string | null>>
export type SaveProviderKeyResult = { ok: true } | { ok: false; error: string }
export type RemoveProviderKeyResult = SaveProviderKeyResult
export interface ProviderKeySettings {
  keyHints: ProviderKeyHints | null
  loadError: string | null
  ready: boolean
  hasEmbeddings: boolean
  hasChatProvider: boolean
  reload: () => void
  onSaveKey: (
    provider: ProviderDefinition,
    apiKey: string,
  ) => Promise<SaveProviderKeyResult>
  onRemoveKey: (
    provider: ProviderDefinition,
  ) => Promise<RemoveProviderKeyResult>
}
