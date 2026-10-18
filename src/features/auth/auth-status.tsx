export function AuthStatus({ error = false }: { error?: boolean }) {
  return (
    <main className="flex min-h-svh items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <p className="mb-6 font-display text-2xl font-semibold tracking-tight">
          SPY
        </p>
        <p
          role={error ? 'alert' : 'status'}
          className="text-sm text-text-secondary"
        >
          {error
            ? 'We couldn’t check your session. Check your connection and try again.'
            : 'Checking your session…'}
        </p>
        {error && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        )}
      </div>
    </main>
  )
}
