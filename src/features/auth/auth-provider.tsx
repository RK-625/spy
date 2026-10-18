import { useCallback, useMemo, useRef } from 'react'
import { ConvexProviderWithAuth } from 'convex/react'
import type { ReactNode } from 'react'
import type { ConvexReactClient } from 'convex/react'
import { authClient } from '~/lib/auth-client'

// Use Convex's typed auth interface directly: the integration provider's
// useSession generic resolves to `never` with the installed Better Auth patch.
export function AuthProvider({
  client,
  initialToken,
  children,
}: {
  client: ConvexReactClient
  initialToken: string | null
  children: ReactNode
}) {
  const useAuth = useMemo(() => {
    return function useBetterAuth() {
      const { data, isPending } = authClient.useSession()
      const sessionId = data?.session.id
      const token = useRef(initialToken)
      const previousSession = useRef(sessionId)
      const pending = useRef<Promise<string | null> | null>(null)

      if (previousSession.current !== sessionId) {
        previousSession.current = sessionId
        token.current = null
        pending.current = null
      }

      const fetchAccessToken = useCallback(
        async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
          if (!sessionId) return null
          if (token.current && !forceRefreshToken) return token.current
          if (pending.current) return pending.current
          const requestedSession = sessionId
          pending.current = authClient.convex
            .token()
            .then(({ data: result }) => {
              if (previousSession.current !== requestedSession) return null
              token.current = result?.token ?? null
              return token.current
            })
            .catch(() => null)
            .finally(() => {
              if (previousSession.current === requestedSession)
                pending.current = null
            })
          return pending.current
        },
        [sessionId],
      )

      return useMemo(
        () => ({
          isLoading: isPending,
          isAuthenticated: Boolean(sessionId),
          fetchAccessToken,
        }),
        [isPending, sessionId, fetchAccessToken],
      )
    }
  }, [initialToken])

  return (
    <ConvexProviderWithAuth client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithAuth>
  )
}
