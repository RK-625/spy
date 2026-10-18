# Workspace port

Reference: [RK-625/spy-frontend at 119b082](https://github.com/RK-625/spy-frontend/tree/119b08245b101a3aeabbe3e7ca1ea67cd1400878).

## Completed workspace foundation

| Source responsibility                                  | Destination                                                                          | State                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Workspace layout and route switcher                    | `src/routes/_authenticated.tsx`, `src/components/workspace/workspace-shell.tsx`      | Ported with TanStack navigation; login guard remains authoritative                             |
| Sidebar frame, header, icon/full modes and theme glyph | `src/components/workspace/sidebar/`                                                  | Ported with original widths, palette, spacing and Motion tokens                                |
| Command palette                                        | `src/components/workspace/search/`                                                   | Ported with navigation, settings and theme actions; history search awaits data                 |
| General and Appearance settings                        | `src/components/workspace/settings/`                                                 | Appearance ported; General shows the actual session and provides sign-out                      |
| Theme provider and switch hook                         | `src/components/theme/`                                                              | Ported without Electron theme synchronization; dark default and Light/Dark/System persistence  |
| Customized Radix primitives                            | `src/components/ui/`                                                                 | Ported button, button group, separator, dialog and tooltip with direct imports                 |
| Providers, embeddings and tools                        | `src/components/workspace/settings/`, `src/features/providers/`, `convex/providers/` | Ported with encrypted per-user Convex persistence, masked status, save/remove and setup gating |
| Login-only access                                      | Existing auth feature and backend config                                             | Preserved; public signup and account management stay disabled                                  |

`/`, `/chat`, `/notes`, and `/graph` mount the shared shell after authentication.
Their feature content is still blank. Provider settings now gate access until the user saves a Google embeddings key
and at least one chat-provider key. Google can satisfy both requirements. No
conversations, notes, graphs, keys, or user records were migrated or fabricated.

## Remaining feature ports

| Feature                              | Original source                                                                                                   | Required integration                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Chat prompt and conversation         | `src/components/chat/prompt`, `conversation`, `src/app/(workspace)/chat/page.tsx`, `src/contexts/ChatContext.tsx` | Convex conversation state, send/stop/resume transport, model availability and tool wiring |
| Recent conversations                 | `src/components/chat/sidebar/recents`                                                                             | User-scoped Convex listing, selection and deletion                                        |
| Notes hierarchy, detail and learning | `src/components/chat/sidebar/notes`, `workspace`, `src/lib/notes`                                                 | Convex notes/relationships and replacement for server-side Falkor reads                   |
| Knowledge graph                      | `src/components/graph`, `src/contexts/GraphTopologyContext.tsx`                                                   | Graph topology subscription and browser-only Sigma/WebGL rendering                        |

## Provider ownership

The web app uses each user's own provider keys, encrypted in Convex rather than
the original macOS keychain. Public status exposes only masked hints; keys are
not persisted in browser storage. Removing a required key returns the workspace
to setup. The server-only credential helper enforces the same requirements for
future model and embedding actions, with no shared-key fallback.

See `docs/provider-keys.md` for storage, encryption and integration details.
Chat execution and note/graph persistence still require their feature ports.

## Verification

The provider-key sprint uses static compilation and lint only. The user will
manually provision an existing Better Auth account and exercise login, key
saving, persistence and setup gating. No account/key-flow tests or provider
requests were run for this feature. The following checks describe the earlier
shell sprint, before provider settings were connected.

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
pending. Provider-key functions are deployed to development deployment
`secret-nightingale-447`.
