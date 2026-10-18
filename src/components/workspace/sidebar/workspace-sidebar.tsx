import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Search, Settings, SquarePen } from 'lucide-react'
import { WORKSPACE_ROUTES, isWorkspaceRouteActive } from '../navigation'
import { ChatSidebarHeader } from './sidebar-header'
import { ChatSidebarItem } from './sidebar-item'
import { RouteSwitcherStrip } from './route-switcher'
import { ThemeToggleGlyph } from './theme-toggle-glyph'
import type { ReactNode } from 'react'
import type { WorkspacePath } from '../navigation'
import {
  RESOLVED_THEME_LABEL,
  findOppositeTheme,
} from '~/components/theme/theme-preference'
import { useThemeSwitch } from '~/components/theme/use-theme-switch'
import { CHROME_FADE, MOTION } from '~/styles/tokens/motion'

type SidebarMode = 'icon' | 'full'
const SIDEBAR_MODE_STORAGE_KEY = 'spy-sidebar-mode'
const SIDEBAR_ICON_WIDTH = 56
const SIDEBAR_FULL_WIDTH = 240

export function WorkspaceSidebar({
  pathname,
  onNavigate,
  onOpenSearch,
  onOpenSettings,
  settingsOpen,
  children,
  onNewChat,
}: {
  pathname: string
  onNavigate: (path: WorkspacePath) => void
  onOpenSearch: () => void
  onOpenSettings: () => void
  settingsOpen: boolean
  children?: ReactNode
  onNewChat?: () => void
}) {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('icon')
  const reducedMotion = useReducedMotion()
  const { resolvedTheme, switchTheme } = useThemeSwitch()
  const targetTheme = findOppositeTheme(resolvedTheme)
  const sidebarExpanded = sidebarMode === 'full'

  useEffect(() => {
    const readMode = () => {
      try {
        const saved = localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY)
        if (saved === 'icon' || saved === 'full') setSidebarMode(saved)
      } catch {
        /* Navigation still works without browser storage. */
      }
    }
    readMode()
    const onStorage = (event: StorageEvent) => {
      if (event.key === SIDEBAR_MODE_STORAGE_KEY) readMode()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function toggleSidebarMode() {
    setSidebarMode((previous) => {
      const next = previous === 'icon' ? 'full' : 'icon'
      try {
        localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, next)
      } catch {
        /* Session-only preference. */
      }
      return next
    })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.shiftKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== 'b'
      )
        return
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [role="dialog"]'))
      )
        return
      event.preventDefault()
      toggleSidebarMode()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <motion.aside
      initial={false}
      animate={{
        width: sidebarExpanded ? SIDEBAR_FULL_WIDTH : SIDEBAR_ICON_WIDTH,
      }}
      transition={reducedMotion ? { duration: 0 } : MOTION.spring}
      aria-label="Workspace navigation"
      className="relative z-20 flex h-full shrink-0 flex-col overflow-hidden border-r border-border-subtle bg-surface-elevated/85 backdrop-blur-md"
    >
      <ChatSidebarHeader
        isSidebarFull={sidebarExpanded}
        onToggleSidebarMode={toggleSidebarMode}
        onOpenCommandPalette={onOpenSearch}
      />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <AnimatePresence initial={false} mode="wait">
          {sidebarExpanded ? (
            <motion.div
              key="full"
              {...CHROME_FADE}
              transition={reducedMotion ? { duration: 0 } : MOTION.chrome}
              className="absolute inset-y-0 left-0 flex w-60 flex-col"
            >
              <nav aria-label="Workspace views" className="px-3 py-3">
                <RouteSwitcherStrip
                  pathname={pathname}
                  onOpenChat={() => onNavigate('/chat')}
                  onOpenNotes={() => onNavigate('/notes')}
                  onOpenGraph={() => onNavigate('/graph')}
                />
                {onNewChat && (
                  <div className="mt-3">
                    <ChatSidebarItem
                      icon={SquarePen}
                      label="New chat"
                      onClick={onNewChat}
                      showLabel
                    />
                  </div>
                )}
              </nav>
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            </motion.div>
          ) : (
            <motion.nav
              key="icon"
              {...CHROME_FADE}
              transition={reducedMotion ? { duration: 0 } : MOTION.chrome}
              aria-label="Workspace views"
              className="absolute inset-y-0 left-0 flex w-14 flex-col gap-1.5 px-3 py-3"
            >
              {WORKSPACE_ROUTES.map(({ path, label, icon }) => (
                <ChatSidebarItem
                  key={path}
                  icon={icon}
                  label={label}
                  onClick={() => onNavigate(path)}
                  active={isWorkspaceRouteActive(pathname, path)}
                  showLabel={false}
                />
              ))}
              {onNewChat && (
                <ChatSidebarItem
                  icon={SquarePen}
                  label="New chat"
                  onClick={onNewChat}
                  showLabel={false}
                />
              )}
              <div
                aria-hidden
                className="my-1 h-px bg-[var(--accent-border)]"
              />
              <ChatSidebarItem
                icon={Search}
                label="Search"
                shortcut="⌘K"
                onClick={onOpenSearch}
                showLabel={false}
              />
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
      <div className="relative flex flex-col gap-1.5 px-3 py-3">
        <div
          aria-hidden
          className="pointer-events-none absolute left-3 right-3 top-0 h-px bg-[var(--accent-border)]"
        />
        <ChatSidebarItem
          icon={ThemeToggleGlyph}
          label={`${RESOLVED_THEME_LABEL[targetTheme]} theme`}
          onClick={() => switchTheme(targetTheme)}
          showLabel={sidebarExpanded}
        />
        <ChatSidebarItem
          icon={Settings}
          label="Settings"
          onClick={onOpenSettings}
          active={settingsOpen}
          showLabel={sidebarExpanded}
        />
      </div>
    </motion.aside>
  )
}
