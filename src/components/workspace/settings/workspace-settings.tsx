import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AppearancePane } from './appearance-pane'
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_CARD_LABEL_CLASS,
  SettingsPaneHeader,
} from './settings-pane-chrome'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '~/components/ui/overlays/dialog'
import { Button } from '~/components/ui/actions/button'
import { CHROME_FADE, MOTION } from '~/styles/tokens/motion'
import { cn } from '~/lib/utils'

const PANES = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
] as const
type SettingsPane = (typeof PANES)[number]['id']

export function WorkspaceSettings({
  open,
  onOpenChange,
  user,
  onSignOut,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { name: string; email: string }
  onSignOut: () => Promise<void>
}) {
  const [activePane, setActivePane] = useState<SettingsPane>('general')
  const [signOutPending, setSignOutPending] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const reducedMotion = useReducedMotion()

  async function handleSignOut() {
    setSignOutPending(true)
    setSignOutError(null)
    try {
      await onSignOut()
    } catch {
      setSignOutError('Couldn’t sign out. Please try again.')
      setSignOutPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(var(--settings-dialog-h),calc(100dvh-2rem))] flex-col gap-0 overflow-hidden rounded-lg border border-[var(--border-medium)] bg-[var(--surface-input-opaque)] p-0 shadow-[0_24px_60px_var(--shadow-dialog)] backdrop-blur-md sm:max-w-[var(--settings-dialog-w)] sm:flex-row">
        <DialogDescription className="sr-only">
          Spy session and appearance preferences.
        </DialogDescription>
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 flex-row gap-1 border-b border-border-subtle px-3 py-4 pr-12 sm:w-[var(--settings-nav-w)] sm:flex-col sm:border-b-0 sm:border-r sm:py-5 sm:pr-3"
        >
          <DialogTitle className="sr-only sm:not-sr-only sm:px-2.5 sm:pb-3.5 sm:font-terminal sm:text-xl sm:tracking-widest sm:text-primary">
            Settings
          </DialogTitle>
          {PANES.map(({ id, label }) => (
            <button
              type="button"
              key={id}
              aria-current={activePane === id ? 'page' : undefined}
              onClick={() => setActivePane(id)}
              className={cn(
                'relative rounded-lg px-2.5 py-2 text-left text-sm',
                activePane === id
                  ? 'text-primary'
                  : 'text-lavender-muted hover:text-primary-hover',
              )}
            >
              {activePane === id && (
                <motion.span
                  layoutId="settings-nav-highlight"
                  className="absolute inset-0 rounded-lg bg-[var(--surface-hover)]"
                  transition={reducedMotion ? { duration: 0 } : MOTION.spring}
                />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </nav>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={activePane}
              {...CHROME_FADE}
              transition={reducedMotion ? { duration: 0 } : MOTION.chrome}
              className="flex flex-col gap-4"
            >
              {activePane === 'appearance' ? (
                <AppearancePane />
              ) : (
                <>
                  <SettingsPaneHeader
                    title="General"
                    description="Your Spy session."
                  />
                  <div className={SETTINGS_CARD_CLASS}>
                    <div className={SETTINGS_CARD_LABEL_CLASS}>
                      Signed in as
                    </div>
                    <p className="break-words text-sm text-text-primary">
                      {user.name}
                    </p>
                    <p className="mt-1 break-words text-sm text-text-secondary">
                      {user.email}
                    </p>
                  </div>
                  {signOutError && (
                    <p role="alert" className="text-sm text-destructive">
                      {signOutError}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    disabled={signOutPending}
                    onClick={() => void handleSignOut()}
                    className="self-start"
                  >
                    {signOutPending ? 'Signing out…' : 'Sign out'}
                  </Button>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
