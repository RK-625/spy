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

## Conversation component sprint

Ported the source message/conversation components to
`src/features/chat/conversation/`: streaming Markdown with code, CJK, math and
Mermaid plugins, attachment previews, reasoning/tool timelines, sources,
clipboard feedback, message action rails and scroll-to-latest behavior. The
view accepts messages and callbacks; it does not fetch keys or call models.
Preserved the source widget styles and dot-matrix glyphs. Loading labels are
deterministic during hydration; keyboard and reduced-motion handling were
adapted for the web.

An isolated presentation preview lives at `http://localhost:3016/conversation`
when running the existing workspace fixture. It uses local presentation data
only, with no account/key/backend imports. The production routes do not yet
mount this renderer; the composer and durable conversation transport come next.

## Composer component sprint

Ported the original prompt under `src/features/chat/prompt/`: browser-only
Milkdown Markdown editor with a shared textarea fallback, file picker/paste/drop
validation and chips, quote chips, pending-question options, voice input,
model/mode pickers and source tool controls. `PromptInputWorkspace` receives key
status, settings navigation and send/stop handlers as props. Unimplemented tools
can be hidden by the owning feature until their server handlers exist.

`PromptInputProvider` exposes an initial draft and change callback rather than
copying the desktop IndexedDB/database access. The owning feature must wait for
its saved draft before mounting and supply persistence. File blobs and API keys
are never mixed. The form awaits turn acceptance before clearing; failed sends
and edits made during an upload retain their draft.

The isolated `/composer` fixture renders this UI with presentation-only key
hints and appends user messages in memory. It never calls a model or backend.
`features/chat/chat-workspace.tsx` now composes the conversation and composer,
including the source selection toolbar: completed message excerpts preserve
Markdown structure and become quote chips in the shared draft. Each conversation
has a separate selection scope. Production route composition, durable drafts and
chat transport remain next.

## Remaining feature ports

| Feature                                    | Original source                                                                                                   | Required integration                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Chat composer and conversation integration | `src/components/chat/prompt`, `conversation`, `src/app/(workspace)/chat/page.tsx`, `src/contexts/ChatContext.tsx` | Compose the ported renderer with the prompt; Convex state, send/stop/resume, model availability and tools |
| Recent conversations                       | `src/components/chat/sidebar/recents`                                                                             | User-scoped Convex listing, selection and deletion                                                        |
| Notes hierarchy, detail and learning       | `src/components/chat/sidebar/notes`, `workspace`, `src/lib/notes`                                                 | Convex notes/relationships and replacement for server-side Falkor reads                                   |
| Knowledge graph                            | `src/components/graph`, `src/contexts/GraphTopologyContext.tsx`                                                   | Graph topology subscription and browser-only Sigma/WebGL rendering                                        |

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
