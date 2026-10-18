import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { WorkspaceSidebar } from './sidebar/workspace-sidebar'
import { WorkspaceSettings } from './settings/workspace-settings'
import { CommandPalette } from './search/command-palette'
import { WORKSPACE_ROUTES } from './navigation'
import type { ReactNode } from 'react'
import type { WorkspacePath } from './navigation'
import { TooltipProvider } from '~/components/ui/overlays/tooltip'

export function WorkspaceShell({
  user,
  onSignOut,
  children,
}: {
  user: { name: string; email: string }
  onSignOut: () => Promise<void>
  children: ReactNode
}) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const commandGroups = useMemo(
    () => [
      {
        heading: 'Workspace',
        items: WORKSPACE_ROUTES.map(({ path, label, icon }) => ({
          label,
          icon,
          href: path,
        })),
      },
      {
        heading: 'Actions',
        items: [
          {
            label: 'Settings',
            icon: Settings,
            action: () => setSettingsOpen(true),
          },
        ],
      },
    ],
    [],
  )

  function navigateTo(path: WorkspacePath) {
    void navigate({ to: path })
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="workspace-root relative flex h-svh min-h-0 w-full overflow-hidden bg-surface-chat">
        <a
          href="#workspace-content"
          className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-16 focus:top-3"
        >
          Skip to workspace
        </a>
        <WorkspaceSidebar
          pathname={pathname}
          onNavigate={navigateTo}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          settingsOpen={settingsOpen}
        />
        <div
          id="workspace-content"
          tabIndex={-1}
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none"
        >
          {children}
        </div>
        <CommandPalette
          open={searchOpen}
          onOpenChange={setSearchOpen}
          groups={commandGroups}
          placeholder="Search actions…"
          trigger={null}
          shortcutKey="k"
          showThemeGroup
        />
        <WorkspaceSettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          user={user}
          onSignOut={onSignOut}
        />
      </div>
    </TooltipProvider>
  )
}
