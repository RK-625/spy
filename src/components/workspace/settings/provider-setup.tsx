import { CheckCheck, KeyRound } from 'lucide-react'
import type { ProviderKeySettings } from '~/lib/providers/types'
import { Button } from '~/components/ui/actions/button'
import { Spinner } from '~/components/ui/feedback/spinner'

export function ProviderSetup({
  keys,
  onOpenSettings,
}: {
  keys: ProviderKeySettings
  onOpenSettings: () => void
}) {
  const loading = keys.keyHints === null && !keys.loadError
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-12">
      <section
        aria-labelledby="provider-setup-title"
        className="w-full max-w-sm"
      >
        <KeyRound
          className="mb-5 text-lavender"
          size={24}
          strokeWidth={1.5}
          aria-hidden
        />
        <h1
          id="provider-setup-title"
          className="font-display text-xl font-medium text-text-primary"
        >
          Bring your keys
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-lavender-muted">
          Spy uses your own API keys. Add a Google embeddings key and at least
          one chat provider key to enter the workspace.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-text-secondary">
          Your Google key can cover both. Saved keys are encrypted and stay with
          your account across visits.
        </p>
        {loading ? (
          <p
            role="status"
            className="mt-6 flex items-center gap-2 text-sm text-lavender-muted"
          >
            <Spinner />
            Loading your saved keys…
          </p>
        ) : keys.loadError ? (
          <>
            <p role="alert" className="mt-6 text-sm text-destructive">
              {keys.loadError}
            </p>
            <Button variant="outline" className="mt-4" onClick={keys.reload}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <ul className="my-6 space-y-3 text-sm">
              {[
                { label: 'Google embeddings key', ready: keys.hasEmbeddings },
                {
                  label: 'At least one chat provider',
                  ready: keys.hasChatProvider,
                },
              ].map((requirement) => (
                <li
                  key={requirement.label}
                  className="flex items-center gap-2.5 text-text-secondary"
                >
                  {requirement.ready ? (
                    <CheckCheck
                      size={16}
                      className="text-status-success"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="size-4 rounded-full border border-[var(--border-medium)]"
                      aria-hidden
                    />
                  )}
                  <span>
                    {requirement.label}
                    <span className="sr-only">
                      {requirement.ready ? ': saved' : ': required'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Button variant="secondary" onClick={onOpenSettings}>
              Set up API keys
            </Button>
          </>
        )}
      </section>
    </div>
  )
}
