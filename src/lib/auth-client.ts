import { convexClient } from '@convex-dev/better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  plugins: [convexClient()],
  sessionOptions: {
    refetchInterval: 60,
    refetchOnWindowFocus: true,
  },
})

export async function signOut() {
  const { error } = await authClient.signOut()
  if (error) throw new Error('Couldn’t sign out. Please try again.')
  // Reset the router and all user-scoped query data between sessions.
  window.location.replace('/login')
}
