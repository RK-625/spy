/**
 * Providers (chat models), Embeddings and Tools panes. Split by registry
 * capability: Google also serves chat; tool-only providers are excluded from the model picker.
 */

import { AnimatePresence, motion } from 'motion/react'
import { ProviderKeyList } from './keys/provider-key-list'
import { SettingsPaneHeader } from './settings-pane-chrome'
import type { ProviderKeyListProps } from './keys/provider-key-list'
import { Google } from '~/components/brand/providers/google'
import { ICON_GLYPH } from '~/styles/tokens/icons'
import { CHROME_FADE, MOTION } from '~/styles/tokens/motion'
import { providers } from '~/lib/providers/registry'

export const chatProviders = providers.filter(
  (provider) =>
    provider.capabilities.includes('chat') &&
    !provider.capabilities.includes('embeddings'),
)
export const embeddingProviders = providers.filter((provider) =>
  provider.capabilities.includes('embeddings'),
)
export const toolProviders = providers.filter((provider) =>
  provider.capabilities.includes('webSearch'),
)

type ProviderPaneProps = Pick<
  ProviderKeyListProps,
  'keyHints' | 'onSaveKey' | 'onRemoveKey'
> & {
  loadError: string | null
}

function LoadErrorNotice({ loadError }: { loadError: string | null }) {
  if (!loadError) return null
  return (
    <p className="text-xs text-destructive" role="alert">
      {loadError}
    </p>
  )
}

export function ProvidersPane({
  keyHints,
  loadError,
  onSaveKey,
  onRemoveKey,
}: ProviderPaneProps) {
  return (
    <>
      <SettingsPaneHeader
        description="Add your own keys for chat models. Your Google key also enables Google chat."
        title="Providers"
      />
      <LoadErrorNotice loadError={loadError} />
      <ProviderKeyList
        keyHints={keyHints}
        onRemoveKey={onRemoveKey}
        onSaveKey={onSaveKey}
        providers={chatProviders}
      />
    </>
  )
}

export function EmbeddingsPane({
  keyHints,
  loadError,
  onSaveKey,
  onRemoveKey,
  isEmbeddingKeyMissing,
}: ProviderPaneProps & { isEmbeddingKeyMissing: boolean }) {
  return (
    <>
      <SettingsPaneHeader
        description="Turns your notes into searchable memory."
        title="Embeddings"
      />
      <AnimatePresence initial={false}>
        {isEmbeddingKeyMissing && (
          <motion.div
            {...CHROME_FADE}
            className="flex gap-3 rounded-[var(--radius)] border border-[var(--glow-line)] bg-[var(--surface-hover)] px-3.5 py-3"
            transition={MOTION.chrome}
          >
            <Google
              aria-hidden
              className="mt-0.5 flex-none"
              height={ICON_GLYPH.inline}
              width={ICON_GLYPH.inline}
            />
            <p className="text-sm leading-normal">
              <span className="font-medium text-text-primary">
                Google key required.
              </span>{' '}
              <span className="text-lavender-muted">
                Add your Google key to complete workspace setup. It supports
                embeddings and Google chat.
              </span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <LoadErrorNotice loadError={loadError} />
      <ProviderKeyList
        keyHints={keyHints}
        onRemoveKey={onRemoveKey}
        onSaveKey={onSaveKey}
        providers={embeddingProviders}
      />
    </>
  )
}

export function ToolsPane({
  keyHints,
  loadError,
  onSaveKey,
  onRemoveKey,
}: ProviderPaneProps) {
  return (
    <>
      <SettingsPaneHeader
        description="Optional web search. Saving an Exa key verifies it with one search, which may incur an Exa charge."
        title="Tools"
      />
      <LoadErrorNotice loadError={loadError} />
      <ProviderKeyList
        keyHints={keyHints}
        onRemoveKey={onRemoveKey}
        onSaveKey={onSaveKey}
        providers={toolProviders}
      />
    </>
  )
}
