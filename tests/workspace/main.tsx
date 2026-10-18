import { createRoot } from 'react-dom/client'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { Suspense, lazy } from 'react'
import { AppThemeProvider } from '~/components/theme/theme-provider'
import { WorkspaceShell } from '~/components/workspace/workspace-shell'
import '~/styles/app.css'

const ConversationPreview = lazy(() =>
  import('./conversation-preview').then((module) => ({
    default: module.ConversationPreview,
  })),
)

const ComposerPreview = lazy(() =>
  import('./composer-preview').then((module) => ({
    default: module.ComposerPreview,
  })),
)

// Isolated UI fixture. It never imports the application router, auth client,
// session guard, or backend and cannot bypass the production login flow.
function FixtureRoot() {
  return (
    <AppThemeProvider>
      <WorkspaceShell
        user={{ name: 'Workspace fixture', email: 'fixture@example.invalid' }}
        onSignOut={() => Promise.reject(new Error('Fixture sign-out error'))}
      >
        <Outlet />
      </WorkspaceShell>
    </AppThemeProvider>
  )
}

const rootRoute = createRootRoute({ component: FixtureRoot })
const children = (['/', '/chat', '/notes', '/graph'] as const).map((path) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => (
      <main
        aria-label={`${path === '/' ? 'Workspace' : path.slice(1)} fixture`}
        className="h-full min-h-0"
      />
    ),
  }),
)
const conversationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conversation',
  component: () => (
    <Suspense
      fallback={
        <p role="status" className="p-4 text-sm text-lavender-muted">
          Loading conversation preview…
        </p>
      }
    >
      <ConversationPreview />
    </Suspense>
  ),
})
const router = createRouter({
  routeTree: rootRoute.addChildren([
    ...children,
    conversationRoute,
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/composer',
      component: () => (
        <Suspense
          fallback={
            <p role="status" className="p-4">
              Loading composer preview…
            </p>
          }
        >
          <ComposerPreview />
        </Suspense>
      ),
    }),
  ]),
})
const root = document.getElementById('root')
if (!root) throw new Error('Missing workspace fixture root')
createRoot(root).render(<RouterProvider router={router} />)
