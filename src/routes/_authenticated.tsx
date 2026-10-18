import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { SessionGuard } from '~/features/auth/session-guard'
import { ProviderWorkspace } from '~/features/providers/provider-workspace'
import { ChatRecents } from '~/features/chat/sidebar/recents'
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
  const navigate = useNavigate()
  return (
    <SessionGuard>
      {session && (
        <ProviderWorkspace
          key={session.user.id}
          user={session.user}
          onSignOut={signOut}
          sidebarContent={<ChatRecents />}
          onNewChat={() => {
            void navigate({
              to: '/chat',
              search: { draft: crypto.randomUUID() },
            })
          }}
        >
          <Outlet />
        </ProviderWorkspace>
      )}
    </SessionGuard>
  )
}
