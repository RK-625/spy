import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { SessionGuard } from '~/features/auth/session-guard'
import { WorkspaceShell } from '~/components/workspace/workspace-shell'
import { authClient, signOut } from '~/lib/auth-client'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: '/login', replace: true })
    }
  },
  component: AuthenticatedWorkspace,
})

function AuthenticatedWorkspace() {
  const { data: session } = authClient.useSession()
  return (
    <SessionGuard>
      {session && (
        <WorkspaceShell user={session.user} onSignOut={signOut}>
          <Outlet />
        </WorkspaceShell>
      )}
    </SessionGuard>
  )
}
