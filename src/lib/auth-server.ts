import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

const convexUrl = import.meta.env.VITE_CONVEX_URL
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL

if (!convexUrl || !convexSiteUrl) {
  throw new Error('VITE_CONVEX_URL and VITE_CONVEX_SITE_URL must be configured')
}

// Auth requests stay on the app origin so HTTP-only cookies also work in SSR.
export const { handler, getToken } = convexBetterAuthReactStart({
  convexUrl,
  convexSiteUrl,
})
