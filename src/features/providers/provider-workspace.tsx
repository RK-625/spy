import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useAction, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { WorkspaceAccessContext } from './workspace-access'
import type { SettingsPane } from '~/components/workspace/settings/workspace-settings'
import type { ComponentType, ReactNode } from 'react'
import type { CommandPaletteProps } from '~/components/workspace/search/command-palette'
import type {
  ProviderDefinition,
  ProviderKeySettings,
} from '~/lib/providers/types'
import { WorkspaceShell } from '~/components/workspace/workspace-shell'

/** The feature owns Convex access; shared workspace chrome receives only props. */
export function ProviderWorkspace({
  user,
  onSignOut,
  children,
  sidebarContent,
  onNewChat,
  searchComponent,
}: {
  user: { name: string; email: string }
  onSignOut: () => Promise<void>
  children: ReactNode
  sidebarContent?: ReactNode
  onNewChat?: () => void
  searchComponent?: ComponentType<CommandPaletteProps>
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPane, setSettingsPane] = useState<SettingsPane>('general')
  const openSettings = useCallback((pane: SettingsPane) => {
    setSettingsPane(pane)
    setSettingsOpen(true)
  }, [])
  const status = useQuery({
    ...convexQuery(api.providers.keys.status, {}),
    retry: false,
  })
  const save = useAction(api.providers.actions.save)
  const remove = useMutation(api.providers.keys.remove)
  const reload = useCallback(() => {
    void status.refetch()
  }, [status.refetch])
  const onSaveKey = useCallback(
    async (provider: ProviderDefinition, apiKey: string) => {
      try {
        return await save({ provider: provider.id, apiKey })
      } catch {
        return {
          ok: false as const,
          error: 'Couldn’t save your key. Check your connection and try again.',
        }
      }
    },
    [save],
  )
  const onRemoveKey = useCallback(
    async (provider: ProviderDefinition) => {
      try {
        await remove({ provider: provider.id })
        return { ok: true as const }
      } catch {
        return {
          ok: false as const,
          error: 'Couldn’t remove your key. Please try again.',
        }
      }
    },
    [remove],
  )
  const keys = useMemo<ProviderKeySettings>(() => {
    const data = status.isSuccess ? status.data : null
    return {
      keyHints: data
        ? Object.fromEntries(data.keys.map((key) => [key.id, key.keyHint]))
        : null,
      loadError: status.isError
        ? 'Couldn’t load your saved keys. Check your connection and try again.'
        : null,
      ready: data?.ready ?? false,
      hasEmbeddings: data?.hasEmbeddings ?? false,
      hasChatProvider: data?.hasChatProvider ?? false,
      reload,
      onSaveKey,
      onRemoveKey,
    }
  }, [
    status.isSuccess,
    status.isError,
    status.data,
    reload,
    onSaveKey,
    onRemoveKey,
  ])

  const access = useMemo(() => ({ keys, openSettings }), [keys, openSettings])
  return (
    <WorkspaceAccessContext value={access}>
      <WorkspaceShell
        user={user}
        onSignOut={onSignOut}
        providerKeys={keys}
        settings={{
          open: settingsOpen,
          pane: settingsPane,
          onOpenChange: setSettingsOpen,
          onPaneChange: setSettingsPane,
        }}
        sidebarContent={keys.ready ? sidebarContent : null}
        onNewChat={onNewChat}
        searchComponent={searchComponent}
      >
        {children}
      </WorkspaceShell>
    </WorkspaceAccessContext>
  )
}
