import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import * as React from 'react'
import { createServerFn } from '@tanstack/react-start'
import {
  getRequestHeaders,
  setResponseHeader,
} from '@tanstack/react-start/server'
import { getSessionCookie } from 'better-auth/cookies'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import type { QueryClient } from '@tanstack/react-query'
import appCss from '~/styles/app.css?url'
import { getToken } from '~/lib/auth-server'
import { AuthStatus } from '~/features/auth/auth-status'
import { AuthProvider } from '~/features/auth/auth-provider'

const getAuth = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  // Cookie presence only avoids needless requests for guests. Better Auth
  // validates the actual session before issuing a token; JWT caching is off.
  if (!getSessionCookie(getRequestHeaders())) return null
  return (await getToken()) ?? null
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}>()({
  headers: () => ({ 'Cache-Control': 'private, no-store', Vary: 'Cookie' }),
  beforeLoad: async ({ context }) => {
    const token = await getAuth()
    if (token) {
      context.convexQueryClient.serverHttpClient?.setAuth(token)
    } else {
      context.convexQueryClient.serverHttpClient?.clearAuth()
    }
    return { token, isAuthenticated: Boolean(token) }
  },
  errorComponent: () => (
    <RootDocument>
      <AuthStatus error />
    </RootDocument>
  ),
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'SPY',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  notFoundComponent: () => <div>Route not found</div>,
  component: RootComponent,
})

function RootComponent() {
  const { convexQueryClient, token } = Route.useRouteContext()
  return (
    <AuthProvider client={convexQueryClient.convexClient} initialToken={token}>
      <RootDocument>
        <Outlet />
      </RootDocument>
    </AuthProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
