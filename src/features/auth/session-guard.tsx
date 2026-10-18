import { useEffect } from 'react'
import { useConvexAuth } from 'convex/react'
import { AuthStatus } from './auth-status'
import type { ReactNode } from 'react'
import { authClient } from '~/lib/auth-client'

export function SessionGuard({ children }: { children: ReactNode }) {
  const { data: session, isPending, error } = authClient.useSession()
  const { isAuthenticated, isLoading } = useConvexAuth()

  useEffect(() => {
    if (!isPending && !error && !session) {
      // A full navigation also drops all cached data from the previous user.
      window.location.replace('/login')
    }
  }, [isPending, error, session])

  if (error) return <AuthStatus error />
  if (isPending || isLoading || !session) return <AuthStatus />
  if (!isAuthenticated) return <AuthStatus error />
  return children
}
