import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { SessionGuard } from '~/features/auth/session-guard'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: '/login', replace: true })
    }
  },
  component: () => (
    <SessionGuard>
      <Outlet />
    </SessionGuard>
  ),
})
