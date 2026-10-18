import { defineApp } from 'convex/server'
import { v } from 'convex/values'
import agent from '@convex-dev/agent/convex.config'
import betterAuth from '@convex-dev/better-auth/convex.config'
import workflow from '@convex-dev/workflow/convex.config'

const app = defineApp({
  env: {
    SITE_URL: v.string(),
    BETTER_AUTH_SECRET: v.string(),
    PROVIDER_KEYS_ENCRYPTION_KEY: v.string(),
  },
})

app.use(betterAuth)
app.use(agent)
app.use(workflow)

export default app
