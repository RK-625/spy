import { createContext, useContext } from 'react'
import type { ProviderKeySettings } from '~/lib/providers/types'
import type { SettingsPane } from '~/components/workspace/settings/workspace-settings'

export const WorkspaceAccessContext = createContext<{
  keys: ProviderKeySettings
  openSettings: (pane: SettingsPane) => void
} | null>(null)

export function useWorkspaceAccess() {
  const value = useContext(WorkspaceAccessContext)
  if (!value) throw new Error('Workspace access requires ProviderWorkspace')
  return value
}
