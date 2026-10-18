# Workspace port

Reference: [RK-625/spy-frontend at 119b082](https://github.com/RK-625/spy-frontend/tree/119b08245b101a3aeabbe3e7ca1ea67cd1400878).

## Completed shell sprint

| Source responsibility                                  | Destination                                                                     | State                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Workspace layout and route switcher                    | `src/routes/_authenticated.tsx`, `src/components/workspace/workspace-shell.tsx` | Ported with TanStack navigation; login guard remains authoritative                            |
| Sidebar frame, header, icon/full modes and theme glyph | `src/components/workspace/sidebar/`                                             | Ported with original widths, palette, spacing and Motion tokens                               |
| Command palette                                        | `src/components/workspace/search/`                                              | Ported with navigation, settings and theme actions; history search awaits data                |
| General and Appearance settings                        | `src/components/workspace/settings/`                                            | Appearance ported; General shows the actual session and provides sign-out                     |
| Theme provider and switch hook                         | `src/components/theme/`                                                         | Ported without Electron theme synchronization; dark default and Light/Dark/System persistence |
| Customized Radix primitives                            | `src/components/ui/`                                                            | Ported button, button group, separator, dialog and tooltip with direct imports                |
| Login-only access                                      | Existing auth feature and backend config                                        | Preserved; public signup and account management stay disabled                                 |

`/`, `/chat`, `/notes`, and `/graph` mount the shared shell after authentication.
Their feature content is still blank. No conversations, notes, graphs, provider
keys, or user records were migrated or fabricated in this sprint.

## Remaining feature ports

| Feature                                 | Original source                                                                                                   | Required integration                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Chat prompt and conversation            | `src/components/chat/prompt`, `conversation`, `src/app/(workspace)/chat/page.tsx`, `src/contexts/ChatContext.tsx` | Convex conversation state, send/stop/resume transport, model availability and tool wiring |
| Recent conversations                    | `src/components/chat/sidebar/recents`                                                                             | User-scoped Convex listing, selection and deletion                                        |
| Notes hierarchy, detail and learning    | `src/components/chat/sidebar/notes`, `workspace`, `src/lib/notes`                                                 | Convex notes/relationships and replacement for server-side Falkor reads                   |
| Knowledge graph                         | `src/components/graph`, `src/contexts/GraphTopologyContext.tsx`                                                   | Graph topology subscription and browser-only Sigma/WebGL rendering                        |
| Providers, embeddings and tool settings | `src/components/chat/overlays/settings/keys`, `panes/provider-panes.tsx`, `src/contexts/ProviderKeysContext.tsx`  | A web-compatible secret ownership/storage decision                                        |

## Decision before the next sprint

The source stores provider keys in the macOS keychain. That does not carry over
to a hosted web app. Confirm whether the web app should use:

- App-managed server keys, shared by the provisioned users; or
- Each user's own keys, with per-user encrypted server storage and the original
  provider settings workflow.

This affects provider settings, model availability, and the prompt's send path.
Do not copy keychain calls, put secrets in browser storage, or silently choose a
shared-key model while porting those pieces.

## Verification

- `bun run build`, `bun run lint`, `bun install --frozen-lockfile`.
- `bun run test:auth` against the running app checks all four protected routes
  and the login-only backend restrictions.
- `bun run test:workspace:dev` starts an isolated fixture on port 3016. Browser
  checks cover sidebar widths/persistence, route selection, keyboard shortcuts,
  search filtering/navigation, theme persistence, settings, reduced motion,
  mobile sizing and sign-out failures.
- A signed-in integrated app walkthrough still requires an existing account's
  login. The fixture verifies shared UI behavior without creating test users.

No web hosting target is configured in this repository, so publishing remains
pending; no backend deployment is required for this UI-only sprint.
