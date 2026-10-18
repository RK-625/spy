import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { FormEvent } from 'react'
import { authClient } from '~/lib/auth-client'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isSignup = mode === 'signup'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    const values = new FormData(event.currentTarget)
    const email = String(values.get('email') ?? '').trim()
    const password = String(values.get('password') ?? '')
    const name = String(values.get('name') ?? '').trim()
    if (isSignup && !name) {
      setError('Enter your name to create an account.')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      const result = isSignup
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password })
      if (result.error) {
        setError(
          result.error.status === 429
            ? 'Too many attempts. Wait a moment before trying again.'
            : isSignup
              ? 'Couldn’t create your account. Check your details or try signing in.'
              : 'Couldn’t sign in. Check your email and password and try again.',
        )
        setIsSubmitting(false)
        return
      }
      // Rebuild the router and query cache with the new server-validated session.
      window.location.replace('/')
    } catch {
      setError('Unable to connect. Check your connection and try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-text-primary">
      <header className="px-6 py-7 sm:px-10">
        <span className="font-display text-2xl font-semibold tracking-tight">
          SPY
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16 pt-8">
        <section aria-labelledby="login-heading" className="w-full max-w-sm">
          <div className="mb-9">
            <p className="mb-4 font-terminal text-xl text-lavender">
              A little space to think.
            </p>
            <h1
              id="login-heading"
              className="font-display text-3xl font-medium leading-tight tracking-tight"
            >
              {isSignup ? 'Make it yours.' : 'Welcome back.'}
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              {isSignup
                ? 'Create an account to start your workspace.'
                : 'Sign in to your workspace.'}
            </p>
          </div>
          <form
            onSubmit={handleSubmit}
            aria-busy={isSubmitting}
            className="space-y-5"
          >
            <fieldset
              disabled={isSubmitting}
              className="space-y-5 disabled:opacity-60"
            >
              {isSignup && (
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-medium">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={100}
                    className="h-12 w-full rounded-lg border border-input bg-surface-input px-3.5 text-base placeholder:text-text-secondary"
                    placeholder="Your name"
                  />
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  autoCapitalize="none"
                  spellCheck={false}
                  className="h-12 w-full rounded-lg border border-input bg-surface-input px-3.5 text-base placeholder:text-text-secondary"
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={
                      isSignup ? 'new-password' : 'current-password'
                    }
                    required
                    minLength={isSignup ? 8 : undefined}
                    maxLength={128}
                    aria-describedby={isSignup ? 'password-hint' : undefined}
                    className="h-12 w-full rounded-lg border border-input bg-surface-input pl-3.5 pr-12 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
                  >
                    {showPassword ? (
                      <EyeOff size={18} aria-hidden="true" />
                    ) : (
                      <Eye size={18} aria-hidden="true" />
                    )}
                  </button>
                </div>
                {isSignup && (
                  <p id="password-hint" className="text-xs text-text-secondary">
                    Use at least 8 characters.
                  </p>
                )}
              </div>
            </fieldset>
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm leading-5 text-destructive"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting
                ? isSignup
                  ? 'Creating account…'
                  : 'Signing in…'
                : isSignup
                  ? 'Create account'
                  : 'Sign in'}
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-text-secondary">
            {isSignup ? 'Already have an account? ' : 'New to SPY? '}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setMode(isSignup ? 'login' : 'signup')
                setError(null)
                setShowPassword(false)
              }}
              className="rounded-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </section>
      </main>
    </div>
  )
}
