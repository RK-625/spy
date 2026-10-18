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

## 2026-10-16 — Auth environment configuration

- Declared required backend `SITE_URL` and `BETTER_AUTH_SECRET` variables in the Convex app config. Added `.env.example` for development deployment/browser URLs, separating backend secrets from public Vite values.
- Validation: Convex TypeScript check, config ESLint check, and `git diff --check` passed.
- Better Auth server and HTTP endpoint implementation pending deployment setup: there is no selected deployment or CLI login, and the generated API does not yet expose `components.betterAuth`. Required backend variables must be set on the chosen development deployment before pushing the config. Sign-in method selection is also pending.

## 2026-10-17 — Development deployment connected

- Connected to the user's development deployment `secret-nightingale-447`. Set missing backend `SITE_URL` to `http://localhost:3000` and generated `BETTER_AUTH_SECRET` directly for deployment storage; no secret values were printed or committed.
- Verified both variable names exist and `bunx convex dev --once --typecheck enable` completed with “Convex functions ready”. Synced the generated Better Auth component API and typed environment declarations.
- Better Auth server, HTTP endpoints, and sign-in method configuration remain the next implementation step.

## 2026-10-18 — Better Auth server and HTTP routes

- Added the Better Auth server using the Convex component adapter, typed backend environment variables, trusted site origin, email/password login, and Convex token integration. Email verification is disabled for this initial sprint.
- Mounted Better Auth HTTP routes and regenerated the Convex API types. Deployed successfully to development deployment `secret-nightingale-447`.
- Validation: Convex TypeScript, targeted ESLint, and whitespace checks passed. `convex dev --once --typecheck enable` reported functions ready; the deployed `/api/auth/get-session` returned HTTP 200 with `null` for an unauthenticated request.
- TanStack Start auth proxy/provider, account screens, and SPY profile provisioning remain separate sprints. Signup/login/logout have not yet been verified end to end through the web application.

## 2026-10-18 — Clarify Better Auth component client naming

- Renamed `authComponent` to `authComponentClient` in the server export, database adapter, and HTTP route registration.
- Validation: Convex TypeScript, targeted ESLint, and whitespace checks passed. Deployed successfully to development deployment `secret-nightingale-447` with `convex dev --once --typecheck enable`.
