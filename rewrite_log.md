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

## 2026-10-18 — Encrypted per-user provider storage

- Confirmed BYOK ownership: require Google embeddings and at least one chat provider (Google can satisfy both). Added user-scoped, indexed Convex key storage with AES-256-GCM encryption and owner/provider binding; public status returns masked hints only. Save verifies fixed provider endpoints before persistence; removal updates the same user-owned row. Added a server-only credential resolver with setup enforcement and no shared-key fallback.
- Configured a separate encryption secret on development deployment `secret-nightingale-447`; no secret values enter Git, browser storage, or logs. Documented recovery and future AI-action integration in `docs/provider-keys.md`.
- Validation is limited to TypeScript compilation and development deployment. Per explicit user request, no accounts or sample keys were created and no provider/key-flow behavior tests were run. Settings UI and setup gating follow in the next commit.

## 2026-10-18 — Provider settings and required-key setup

- Ported source provider logos, password fields, masked verified-key rows, save/remove controls, and Providers/Embeddings/Tools settings. Connected them through a dedicated feature to reactive Convex status; the workspace requires Google embeddings plus at least one chat provider (Google can satisfy both). Missing keys show setup; removing required keys returns to setup. Exa remains optional and its verification search charge is disclosed.
- Kept raw drafts in component state only. Added an account-switch cache boundary so a session change cannot render the previous user's workspace metadata. Shared UI receives props and does not import backend clients.
- Validation: static TypeScript/client/SSR builds, ESLint and whitespace checks only. Per the user's request, skipped all account/key-flow tests, browser tests, sample account/key creation and provider requests; manual verification belongs to the user. Development backend deployed to `secret-nightingale-447`; web publishing remains pending because no hosting target is configured.

## 2026-10-18 — Conversation presentation port

- Ported source conversation/message components, reasoning/tool timelines, source lists, attachment previews, message action rails, clipboard feedback and scroll-to-latest behavior under `features/chat/conversation`. Added the original Streamdown plugins, styles, collapsible primitive and dot-matrix glyphs, with decorative colors owned by palette tokens. The props-based renderer has no backend/key access; production composition awaits the composer and durable chat transport.
- Removed the source renderer's incomplete custom memo comparison, made loading text deterministic during hydration, exposed message actions to keyboard/touch users, and respected reduced motion for scrolling/shimmer/icon motion. Kept preview-only presentation data in the isolated workspace fixture's `/conversation` route.
- Validation: TypeScript, full client/SSR build, static fixture bundle, ESLint and whitespace checks. No browser/account/key-flow tests or provider calls were run. This sprint changes no Convex functions; web publishing remains pending because no hosting target is configured.

## 2026-10-18 — Markdown composer presentation port

- Ported the source prompt editor, attachment pipeline/chips, quote chips, pending-question options, voice control, model/mode picker and optional tool controls. Added its customized Radix input-group/popover/command primitives, toast host and Excalidraw glyph; Milkdown loads only in the browser with the same draft shared by the textarea fallback.
- Replaced desktop context/database imports with explicit draft, key-status, settings-navigation and send/stop interfaces. A turn clears its draft only after acceptance; duplicate sends are guarded and edits during attachment preparation survive. Source file limits and validation remain centralized. Added an isolated `/composer` presentation preview without account/key/backend/model access. Production composition and persistent chat transport remain to be connected.
- Validation: full TypeScript/client/SSR build, static preview bundle, ESLint and whitespace checks. Account/key-flow tests, browser automation and provider requests were not run. This sprint changes no Convex functions; web publishing remains pending because no hosting target is configured.

## 2026-10-18 — Message selection and composed chat surface

- Ported the source floating selection toolbar and rendered-selection-to-Markdown conversion. Only one completed user/assistant message can be quoted; copied text excludes interactive chrome, and excerpts retain list/table/code/emphasis structure. Scoped each toolbar to its own conversation and connected Add to chat to quote chips and composer focus.
- Added the composed `ChatWorkspace` presentation surface and used it in the isolated composer preview. Kept turn acceptance handlers and draft snapshots current during asynchronous attachment preparation, and preserved initial attachment URLs during React Strict Mode's effect replay. Production route/Convex chat integration remains pending.
- Validation: TypeScript, full client/SSR build, static preview bundle, ESLint and whitespace checks only. No account/key-flow tests, browser automation or model/provider requests were run. No Convex deployment changes; web publishing remains pending without a configured hosting target.

## 2026-10-18 — Durable chat backend

- Mounted Convex Agent for user-owned durable threads, paginated history and resumable streaming deltas. Added authenticated conversation list/search/get/send/stop/delete functions, atomic prompt acceptance, bounded retry receipts, serialized turns and timeout recovery. Scheduled workers resolve encrypted credentials from the owning conversation; all five source chat-provider factories use the user's saved key. No gateway/shared-key fallback. Shared the source model/mode catalog between UI and backend.
- Added Agent 0.7.8 and its compatible Convex/AI SDK peers. Registered the BYOK model-ID type domain to avoid an upstream SDK gateway-union expansion while retaining typed v4 model objects. Sanitized browser-visible generation errors. Production route wiring follows in the next sprint.
- Validation: production build, lint, application and Convex TypeScript and whitespace checks passed. Deployed to development deployment `secret-nightingale-447` at 20:59. No account creation, login/key-flow tests, browser automation or provider requests were performed. Web publishing remains pending without a configured hosting target.

## 2026-10-18 — Production chat composition and recents

- Mounted the source conversation/composer on `/chat` with authenticated Agent history and streaming, provider/mode selection, quote sends, turn acceptance, stop and safe conversation-load errors. `/` now opens Chat. Added earlier-message pagination, source recents rows with reactive pagination/delete, New chat in both sidebar modes, and controlled settings access from the composer. Shared chrome still receives props and has no feature/backend imports.
- Preserved source recents/menu styling and made the actions reachable on touch and keyboard. Conversations are created on the first accepted prompt only; URLs reopen the selected persisted thread. Unimplemented tool controls remain hidden. File sends currently refuse with a clear message and retain the draft until storage transport is connected; durable drafts and edit/fork also remain.
- Validation: production build, lint/typecheck and whitespace checks passed; large lazy Markdown/diagram chunks remain a build warning. No account/key tests, browser automation or provider calls were run, per the requested manual verification. Backend was deployed in the preceding sprint; web publishing remains pending because no hosting target is configured.

## 2026-10-18 — Attachments and durable drafts

- Connected authenticated file upload and owner-checked attachment sends with the original five-file/10 MB-per-file limits and shared allowlist. Bytes are stored in Convex; mutations accept only upload references, and Agent messages use the stored file/image URLs. Bounded draft/conversation references retain blobs and release unused files after a 24-hour grace period. Conversation deletion releases file references in batches.
- Added owner-scoped draft persistence for text, quotes, preferences and attachments. Stable draft URLs survive refresh; New chat creates a fresh draft scope. The composer waits for hydration, coalesces/serializes writes during uploads, shows pending/failure state and supports retry. First-send navigation keeps the editor mounted; only the accepted snapshot clears, preserving newer edits. Different editors use last-write-wins semantics.
- Validation: production build, lint, application and Convex TypeScript and whitespace checks passed. Deployed successfully to development `secret-nightingale-447` at 21:15. No account creation, login/key-flow/upload/model tests, browser automation or provider requests were performed, per the manual-verification request. Existing large lazy Markdown/diagram bundle warnings remain. Web publishing awaits a configured host. Remaining port: edit/fork, chat tools/search, Notes and Graph.

## 2026-10-18 — Conversation palette search

- Connected the source command palette to authenticated recent conversations and indexed title search. Empty search shows the latest 20 chats; text search returns up to 30 owner-scoped matches alongside workspace/settings/theme actions. Search includes loading/empty/error states and keeps the original keyboard navigation, focus and close-before-navigation behavior. Queries only subscribe while the palette is open and required provider setup is complete. Shared UI receives results through props and never imports backend features.
- Validation: production build, lint/typecheck and whitespace checks passed. No browser/account/key/provider tests or model calls were performed, per the manual-verification request. This sprint uses the previously deployed search APIs and changes no backend functions. Web publishing still awaits a host. Source review confirmed its Edit button has no handler; destructive history-edit semantics have not been invented. Fork behavior is the next sprint.

## 2026-10-18 — Durable conversation forks

- Connected the source assistant-reply Fork chat action to an owned Agent thread copy through the selected reply, preserving complete tool/reasoning steps and the current composer preferences. Source history and draft remain intact. Added a durable Workflow with progress/failure screens and a link back to the original; incomplete copies cannot accept prompts.
- Authenticated creation validates message/thread ownership and deduplicates requests. Bounded upload-reference copying retains attachments independently of the original; references conservatively cover the source conversation because the existing ledger is conversation-scoped. Deletion is blocked while copying, failed forks are removable, and workflow journals are cleaned up after completion. Partially committed clone actions are not automatically retried. Graph-history copying awaits the graph port.
- Validation: production build, lint/application and Convex type checks and development deployment to `secret-nightingale-447`. No accounts/keys seeded, browser/runtime tests or model/provider calls. User verification remains pending; web hosting is still unconfigured. Remaining ports: executable chat tools, Notes and Graph.

## 2026-10-18 — Optional user-owned web search

- Connected the source globe toggle to accepted turns and Agent's executable `webSearch` tool. Requires the user's saved Exa key and server-checked toggle; scheduled tool calls resolve credentials from the active conversation owner. Returns the same five-result/5,000-character search shape and uses the source 25-step search budget. Existing reasoning UI shows query/result links, plus safe failures.
- Added bounded query/response handling, fixed Exa endpoint, timeout/turn cancellation and safe errors without provider bodies or credentials. Missing keys open Tools settings. No shared credentials, extra service or Exa SDK dependency was added.
- Validation: production build, lint/application and Convex type checks, whitespace checks and development deployment to `secret-nightingale-447`. Corrected a Convex module filename rejected during the first deploy attempt. No account/key/provider/browser/runtime tests or paid API requests were performed. Remaining ports: ask-user interaction, memory/build/Excalidraw tools, Notes and Graph. Web publishing still awaits a host.

## 2026-10-18 — Saved ask-user interaction

- Connected the source multiple-choice/write-in question tool and composer to persisted Agent history. The model yields without executing the tool; reload restores the pending question, and choice/custom answers use the original Q/A normal-message format. Shared bounded parsing validates model input and restored UI. Preserved edits during answer acceptance with a draft-version fence.
- Added authenticated, stale-safe, idempotent dismissal that saves the source cancellation output without invoking a model. Blocks dismissal while a fork copies that source order. Timeline labels the emitted question without a perpetual running state. Agent's installed history loader removes orphaned calls from subsequent model context.
- Validation: production build, lint/application and Convex type checks, whitespace checks and development deployment to `secret-nightingale-447`. No account/key/provider/browser/runtime tests or model calls were performed. Remaining ports: memory/build/Excalidraw tools, Notes and Graph; web publishing still requires a configured host.

## 2026-10-18 — Editor highlight and graph packages

- Added `@milkdown/plugin-highlight`, `shiki`, `graphology`, and `graphology-traversal` dependencies and updated the Bun lockfile in preparation for Milkdown syntax highlighting and Graph visualization.
- Validation: full production build, `bun run lint` (tsc + eslint), and `git diff --check` passed cleanly.
- Web deployment pending: no web hosting target is configured in this repository; this sprint updates dependencies only.

## 2026-10-18 — Convex memory graph store

- Replaced the source FalkorDB graph with owner-scoped Convex tables: `memories` (source core fields), `memoryLinks` (PARENT_OF/RELATES_TO with source-type-target and target-type indexes) and `memoryQuestions` (1536-dim cosine vector index filtered by owner). No second database or Falkor binaries. Convex document IDs are the public Memory IDs.
- Added the reactive `memory.topology.get` query (lean rows plus links, bounded at 2,000 memories/8,000 links with a truncation flag) and `memoryById` for detail/inspection. Added internal tool-facing `getMemories` cones (ancestors/descendants to `hops`, center RELATES_TO, visited-set cycle fuse capped at 200), `listing` and all-or-nothing `manageLinks` (remove then upsert in one transaction, owned endpoints, single PARENT_OF parent unless removed in the same call). One deliberate deviation: self-links are rejected. The source's distance ceiling 0.25 maps to a Convex similarity floor of 0.75.
- Validation: lint/application and Convex type checks, production build and whitespace checks passed. Deployed to development `secret-nightingale-447` at 22:09. No account/key/runtime tests were run; no data seeded. Frontend not deployed (no host). Next: memory writes/embeddings/search, then the Notes UI.

## 2026-10-18 — Memory writes, embeddings and search

- Ported source `upsertMemory`, `deleteMemories` and `searchMemories` under `convex/memory/`. Questions are embedded with `gemini-embedding-2` (1536 dims) using the owner's saved, encrypted Google key, decrypted only in the Node action; no shared-key fallback, and provider bodies never reach results. Embedding happens before one all-or-nothing mutation: create inserts the Memory plus 1–5 questions, patch updates fields and replaces the full question set (required when name/content change). Source create/patch rules are shared by the action and mutation; added document-size bounds the source lacked.
- Delete removes each owned Memory, its questions and every incident link in one transaction (up to 50 IDs; missing IDs are no-ops). Search embeds 1–5 questions, runs one owner-filtered vector probe each (top 10), hydrates hits in a single query, keeps the best hit per Memory and reports source-style cosine distance (1 − similarity, ceiling 0.25). Helpers are callable from the upcoming chat tools; internal actions allow dashboard/CLI runs.
- Validation: lint/application and Convex type checks, production build and whitespace checks passed. Deployed to development `secret-nightingale-447` at 22:15. No embedding/provider calls, account/key or runtime tests were run; no data seeded. Frontend not deployed. Next: register memory tools and build mode in chat.

## 2026-10-18 — Memory tools and build mode in chat

- Registered the source memory tools on every chat turn: `searchMemories` and `getMemories` (nested source cone shape) always; build mode adds `getAllMemories` (source PARENT_OF forest plus RELATES_TO), `upsertMemory`, `deleteMemories` and `manageLinks`. Each call re-resolves the owner from the active stored turn; writes also recheck the turn's server-recorded build mode. Model input is validated before any embedding or write; failures return safe `{ error }` results.
- Ported the source chat and build-mode instructions, graph ontology, maintenance rules and tool descriptions (`convex/chat/prompts/`), listing only tools registered on the turn. The composer build toggle is now visible and sent with each turn; build mode uses the source 25-step budget. Tool error outputs now show on every timeline step. Ported the Notes forest builder to `shared/notes/hierarchy.ts` for the tool and the upcoming sidebar.
- Validation: lint/application and Convex type checks, production build and whitespace checks passed. Renamed hyphenated prompt modules after Convex rejected their paths. Deployed to development `secret-nightingale-447` at 22:22. No model/embedding calls, account/key or runtime tests were run. Frontend not deployed. Not yet ported: the background graph-maintainer agent and its per-chat graph history (which also covers fork graph copying), Excalidraw MCP, Notes UI and Graph view.
