## 2026-10-16 — User profile schema

- Added `users` with `tokenIdentifier`, theme preference, onboarding state, and `updatedAt`; indexed identity lookups with `by_tokenIdentifier`. Preserved the starter `numbers` table.
- Validation: Convex TypeScript check, schema ESLint check, and `git diff --check` passed. Full build blocked by the existing `src/router.tsx:33` unknown error type.
- Authentication wiring is a separate sprint. Deployment pending: this worktree has no configured Convex deployment or web hosting target.

## 2026-10-16 — Better Auth component registration

- Registered Better Auth with `app.use(betterAuth)` in `convex/convex.config.ts`; included the user's installed auth dependencies and Bun lockfile.
- Validation: Convex TypeScript check, config ESLint check, and `git diff --check` passed.
- Deployment pending: no Convex deployment or hosting target is configured in this worktree. Login methods, endpoints, and profile provisioning remain separate steps.

## 2026-10-16 — Better Auth token verification config

- Added `convex/auth.config.ts` using the installed Better Auth integration's `getAuthConfigProvider()`, checked against Convex's `AuthConfig` type.
- Validation: Convex TypeScript check, config ESLint check, and `git diff --check` passed.
- Deployment pending: this worktree still has no configured Convex deployment or hosting target. Token verification requires the forthcoming Better Auth server and JWKS HTTP endpoint before login can work.
