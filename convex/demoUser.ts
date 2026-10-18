import { v } from 'convex/values'
import { internalAction } from './_generated/server'
import { createAuth } from './auth'

// One-off provisioning for a demo account. Public signup is disabled, so this
// writes the user and credential account through Better Auth's internal adapter.
// Run from the CLI/dashboard only; remove once real accounts exist.
export const create = internalAction({
  args: { email: v.string(), password: v.string(), name: v.string() },
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = createAuth(ctx)
    const authContext = await auth.$context
    const email = args.email.trim().toLowerCase()

    const existing = await authContext.internalAdapter.findUserByEmail(email)
    if (existing) {
      return { created: false }
    }

    const user = await authContext.internalAdapter.createUser({
      email,
      name: args.name,
      emailVerified: true,
    })
    await authContext.internalAdapter.linkAccount({
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: await authContext.password.hash(args.password),
    })
    return { created: true }
  },
})
