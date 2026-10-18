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

## 2026-10-18 — Frontend foundation packages

- Installed Motion (matching the original app's v12 major), Radix UI, Lucide, class-variance-authority, clsx, tailwind-merge, and tw-animate-css with Bun. Added the original Inter, Unbounded, and VT323 fonts at 5.3.0 and the shadcn CLI as a development dependency. Updated the Bun lockfile; components, styles, routes, and auth wiring are separate steps.
- Validation: frozen-lockfile install, runtime import and CSS/font asset checks, shadcn CLI version check, standalone ESLint, client/SSR Vite builds, and `git diff --check` passed. Full typecheck (and therefore the combined build/lint scripts) remains blocked by the existing `src/router.tsx:33` unknown error access.
- Web deployment pending: no web hosting target is configured in this repository; this sprint changes dependency setup only.

## 2026-10-18 — Frontend structure and SPY design tokens

- Created the shared UI/brand/workspace and landing/chat/notes/graph feature directories. Documented naming, import boundaries, and token ownership in `src/README.md`; added the shared `cn` utility.
- Ported the original light/dark palettes and shared dimensions, radius, status aliases, and Motion values from `spy-frontend` commit `119b08245b101a3aeabbe3e7ca1ea67cd1400878`. Wired fonts, Tailwind mappings, focus, selection, and scrollbars through the root stylesheet. Used package-hosted Latin fonts instead of Next.js font loaders; removed circular font aliases and mappings for undefined chart tokens. Feature widget styles remain with their future feature ports.
- Set SPY page metadata and English document language. Narrowed the starter router's unknown error value so the full checks can complete. Replaced the incompatible `react-router-with-query` adapter with TanStack's documented `react-router-ssr-query` integration after browser verification exposed a server-rendering failure.
- Validation: `bun run build`, `bun run lint`, frozen-lockfile installation, and `git diff --check` passed. Both palettes match all 97 original declarations; all foundation variable references resolve. Browser checks verified light/dark backgrounds and foregrounds, 10px prompt padding, 32px toolbar controls, and successful Inter/Unbounded/VT323 font loading. A local HTTP check confirmed status 200 and server-rendered content without the prior SSR error after the adapter replacement.
- Web deployment pending: no web hosting target is configured. Theme controls, routes, and workspace components remain the next sprint.

## 2026-10-18 — Better Auth server and HTTP routes

- Added the Better Auth server using the Convex component adapter, typed backend environment variables, trusted site origin, email/password login, and Convex token integration. Email verification is disabled for this initial sprint.
- Mounted Better Auth HTTP routes and regenerated the Convex API types. Deployed successfully to development deployment `secret-nightingale-447`.
- Validation: Convex TypeScript, targeted ESLint, and whitespace checks passed. `convex dev --once --typecheck enable` reported functions ready; the deployed `/api/auth/get-session` returned HTTP 200 with `null` for an unauthenticated request.
- TanStack Start auth proxy/provider, account screens, and SPY profile provisioning remain separate sprints. Signup/login/logout have not yet been verified end to end through the web application.

## 2026-10-18 — Clarify Better Auth component client naming

- Renamed `authComponent` to `authComponentClient` in the server export, database adapter, and HTTP route registration.
- Validation: Convex TypeScript, targeted ESLint, and whitespace checks passed. Deployed successfully to development deployment `secret-nightingale-447` with `convex dev --once --typecheck enable`.

## 2026-10-18 — Merge auth workspace into frontend

- Merged `chats-workspace` at `3229c66` into `frontend`, preserving both branch histories and the frontend foundation. The only conflict was concurrent additions to this log; retained all entries from both branches. No source-code conflicts occurred.
- Validation: full build, full lint, Convex TypeScript, and whitespace checks passed. The local frontend returned HTTP 200 with server-rendered SPY content.
- Deployed the merged backend to development deployment `secret-nightingale-447`; Convex reported functions ready and `/api/auth/get-session` returned HTTP 200 with `null` for an unauthenticated request. Web deployment remains pending because no web hosting target is configured.

## 2026-10-18 — Session-aware routing and login

- Added a same-origin Better Auth proxy and server-validated session context. Guests visiting `/` go to `/login`; authenticated visitors see an intentionally blank workspace and skip `/login`. Replaced the starter demo routes with a reusable protected layout and disabled caching of auth context and rendered pages.
- Added the independent `src/features/auth/login-page.tsx` with email/password sign-in, account creation, password visibility, pending/error states, and existing SPY typography and light/dark tokens. Added a typed Convex auth provider, session polling/focus checks, and a sign-out helper that clears user-scoped browser state through full navigation. The provider uses Convex's auth interface because the integration provider's session generic is incompatible with the installed Better Auth patch; dependencies and backend code are unchanged.
- Validation: full build, lint/typecheck, six HTTP auth regression checks, and whitespace checks passed. Browser checks against development deployment `secret-nightingale-447` verified signup, sign-in, persistence after reload, authenticated login redirects, sign-out, expired-session rejection, and mobile layouts at 390px in both palettes. Removed the temporary test account and its linked credentials/sessions.
- Web deployment remains pending: no hosting target is configured. SPY profile provisioning, password recovery, email verification, and workspace features remain separate sprints.

## 2026-10-18 — Restrict authentication to existing-user login

- Removed account creation and its mode switch from the independent login page. Disabled email/password signup in Better Auth and blocked public account deletion and linking/unlinking endpoints. Existing-user login, session validation, and blank protected workspace routing remain in place; profile provisioning and onboarding are outside the current scope.
- Validation: full build, lint, Convex TypeScript, whitespace checks, and all 12 HTTP auth regression checks passed. Confirmed signup is rejected through both the app proxy and direct Convex HTTP endpoint; deletion/linking endpoints return HTTP 404. No user records were created or removed for this sprint.
- Deployed successfully to development deployment `secret-nightingale-447`. Web deployment remains pending because no hosting target is configured. Existing login accounts require Better Auth password credentials; SPY profile records alone do not supply them.

## 2026-10-18 — Workspace shell port

- Ported the original workspace chrome from `spy-frontend` commit `119b082`: icon/expanded sidebar (56px/240px), Chat/Notes/Graph route switcher, command palette, Light/Dark/System preferences, customized Radix primitives, and General/Appearance settings. Adapted navigation to TanStack and passed the real session/sign-out callback into the shared shell. Added protected `/chat`, `/notes`, and `/graph` routes; feature content remains blank for subsequent ports. Public signup/account-management restrictions are unchanged.
- Added the original `next-themes` version and a Radix state helper matching the app's installed Radix version. Preserved SPY palette, typography, storage keys, and Motion tokens; included reduced-motion handling and mobile settings layout. Added an isolated browser fixture without auth/backend imports or test account creation, plus a source map and remaining work in `docs/workspace-port.md`.
- Validation: full build, lint/typecheck, frozen-lockfile install, whitespace checks, and all 15 auth regressions passed. Browser checks verified route selection, both sidebar widths and persistence, Command/Ctrl+B/K shortcuts, search filtering/keyboard navigation, theme persistence and OS following, settings/sign-out error handling, 358px dialog width at a 390px viewport, reduced-motion overlays, and the actual login route's hydration/rejected credentials. Confirmed fixture identity/code is absent from production bundles. A signed-in integrated workspace walkthrough still requires an existing account; no user data was created, removed, or migrated.
- Remaining port: chat/prompt/history, notes/detail/learning, graph visualization, and provider/embedding/tool settings. The source uses macOS keychain storage; provider-key ownership/storage needs user confirmation before wiring those settings and the prompt. Web publishing remains pending because no hosting target is configured; this sprint changes no Convex backend code.
