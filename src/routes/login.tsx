import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginPage } from '~/features/auth/login-page'

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) {
      throw redirect({ to: '/', replace: true })
    }
  },
  head: () => ({ meta: [{ title: 'Sign in · SPY' }] }),
  component: LoginPage,
})
