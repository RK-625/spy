import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { SessionGuard } from '~/features/auth/session-guard'
import { ProviderWorkspace } from '~/features/providers/provider-workspace'
import { ChatRecents } from '~/features/chat/sidebar/recents'
import { NotesSidebar } from '~/features/notes/sidebar/notes'
import { ChatCommandPalette } from '~/features/chat/search/chat-command-palette'
import { authClient, signOut } from '~/lib/auth-client'
import { isWorkspaceRouteActive } from '~/components/workspace/navigation'

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
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  // Source sidebar body follows the route: recents, the Notes tree or nothing.
  const sidebarContent = isWorkspaceRouteActive(pathname, '/notes') ? (
    <NotesSidebar />
  ) : isWorkspaceRouteActive(pathname, '/graph') ? null : (
    <ChatRecents />
  )
  return (
    <SessionGuard>
      {session && (
        <ProviderWorkspace
          key={session.user.id}
          user={session.user}
          onSignOut={signOut}
          sidebarContent={sidebarContent}
          searchComponent={ChatCommandPalette}
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
