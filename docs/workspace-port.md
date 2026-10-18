# Workspace port

Reference: [RK-625/spy-frontend at 119b082](https://github.com/RK-625/spy-frontend/tree/119b08245b101a3aeabbe3e7ca1ea67cd1400878).

## Completed workspace foundation

| Source responsibility                                  | Destination                                                                          | State                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Workspace layout and route switcher                    | `src/routes/_authenticated.tsx`, `src/components/workspace/workspace-shell.tsx`      | Ported with TanStack navigation; login guard remains authoritative                             |
| Sidebar frame, header, icon/full modes and theme glyph | `src/components/workspace/sidebar/`                                                  | Ported with original widths, palette, spacing and Motion tokens                                |
| Command palette                                        | `src/components/workspace/search/`                                                   | Ported with navigation, settings and theme actions; connected to owner-scoped recents and title search                 |
| General and Appearance settings                        | `src/components/workspace/settings/`                                                 | Appearance ported; General shows the actual session and provides sign-out                      |
| Theme provider and switch hook                         | `src/components/theme/`                                                              | Ported without Electron theme synchronization; dark default and Light/Dark/System persistence  |
| Customized Radix primitives                            | `src/components/ui/`                                                                 | Ported button, button group, separator, dialog and tooltip with direct imports                 |
| Providers, embeddings and tools                        | `src/components/workspace/settings/`, `src/features/providers/`, `convex/providers/` | Ported with encrypted per-user Convex persistence, masked status, save/remove and setup gating |
| Login-only access                                      | Existing auth feature and backend config                                             | Preserved; public signup and account management stay disabled                                  |

`/`, `/chat`, `/notes`, and `/graph` mount the shared shell after authentication.
Chat mounts the ported conversation/composer; Notes and Graph feature content remain blank. Provider settings now gate access until the user saves a Google embeddings key
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
only, with no account/key/backend imports. The production Chat route now mounts this renderer with Agent history and streaming.

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
has a separate selection scope. Production route composition, chat transport, attachment storage, durable drafts and forks are connected. Web search is executable; the remaining tools follow.

## Remaining feature ports

| Feature                                | Original source                                                   | Required integration                                                                     |
| -------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Chat tools | `src/components/chat`, `src/contexts/ChatContext.tsx`, `src/ai`   | Tool handlers and memory retrieval/build mode |
| Notes learning/review sessions         | `src/components/chat/workspace/learning`, `src/lib/notes/session` | Session reducer and learning UI over the ported note detail                              |
| Knowledge graph                        | `src/components/graph`, `src/contexts/GraphTopologyContext.tsx`   | Graph topology subscription and browser-only Sigma/WebGL rendering                       |

## Provider ownership

The web app uses each user's own provider keys, encrypted in Convex rather than
the original macOS keychain. Public status exposes only masked hints; keys are
not persisted in browser storage. Removing a required key returns the workspace
to setup. The server-only credential helper enforces the same requirements for
future model and embedding actions, with no shared-key fallback.

See `docs/provider-keys.md` for storage, encryption and integration details.
Chat uses the saved user key; tool integration and note/graph persistence remain.

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

## Durable chat backend sprint

`convex/chat/` now wraps the Agent component with server-derived ownership for every public operation. Conversations have one durable thread, indexed recents/title search, atomic prompt acceptance, request receipts, one active turn, stop fencing and a timeout recovery job. Histories and streaming deltas use bounded Agent pagination. Scheduled generation obtains the selected user's encrypted credential from the stored conversation, decrypts only in a Node action and uses the original provider factory/model choices. The shared catalog lives in `shared/models.ts`.

This backend is deployed to the development target. Chat route composition, recents, attachments and durable drafts are now connected. Forks are connected; tools remain. Static build/lint/type checks passed; no model calls or account/key tests were run. Streaming is based on the [Convex Agent streaming API](https://docs.convex.dev/agents/streaming).

## Production chat composition sprint

`features/chat/chat-page.tsx` connects the source UI to the Agent-backed APIs. `/chat?chat=<conversationId>` restores history and subscribes to live deltas; `/chat` starts an unsaved conversation, created on first accepted prompt. The full sidebar renders source recents with pagination and delete; both sidebar modes expose New chat. Messages have earlier-history pagination and saved-key model selection opens the shared provider settings. The authenticated root redirects to Chat.

Attachment storage and durable drafts are now connected in the following sprint. Tools, Notes and Graph remain. Tool controls are hidden until executable handlers exist. No model requests or account/key tests were run.

## Attachment and saved-draft sprint

`/chat?draft=<uuid>` identifies an unfinished chat. New chat mints a fresh ID; refresh keeps the current one. A conversation is still created only after the first accepted send. Its draft key stays stable across that send, so the editor remains mounted and newer edits survive. Drafts store text, quotes, model/mode/tool preferences and up to five attachment references in owner-scoped Convex records. Saves debounce and coalesce during uploads, serialize per editor and report pending/failure status; retry resubmits the current snapshot. Different editors use last-write-wins semantics. Wait for Saving draft to finish before closing the browser; in-flight uploads and writes have not yet persisted.

The authenticated `/chat/upload` HTTP action accepts up to 10 MB of bytes per file, enforces the same source file allowlist and derives ownership from the session. It registers only storage objects it just created; clients cannot attach arbitrary storage IDs or URLs. Draft and message mutations recheck every upload's owner. File data stays outside mutation arguments. Storage URLs are created on read and included in Agent message content using the documented [manual file-storage approach](https://docs.convex.dev/agents/files). No desktop file/database APIs are copied.

Bounded reference records retain uploads while any draft or conversation uses them. Unreferenced uploads are removed after a 24-hour grace period; conversation deletion releases references in batches. Sending clears only the accepted draft version. Drafts and credentials remain separate: provider keys retain their existing encrypted server-only path.

Production build, lint, application/Convex type checks and development deployment passed. Account/key/upload/model browser or runtime tests were not run; the user will verify manually. Provider file support still depends on the selected model, as in the original workspace. Web publishing remains pending without a configured host.

## Conversation palette search

The shared palette accepts already-filtered feature groups. `features/chat/search/chat-command-palette.tsx` loads recent chats when empty and uses the owner-filtered Convex title index while typing. Remote and local items share keyboard selection and close-before-navigation handling; loading, no-match and load failures are visible. Only an open palette in a configured workspace subscribes to history queries. No account/provider tests or model calls were run. The original Edit icon is a placeholder without a handler; a destructive edit/resend behavior is outside the source port.

## Conversation forks

Completed assistant replies expose the source Fork chat action. It copies history through the selected Agent order (including reasoning and tool steps), creates a separate owned conversation, carries the current composer preferences into an empty saved draft and leaves the original draft/history intact. A durable Workflow coordinates attachment references and Agent's paginated thread clone; the destination shows progress and becomes sendable only after completion. Refresh/navigation does not cancel the server copy. No model request is needed.

Public creation derives ownership from the session and validates the selected message belongs to that source thread. Fork request IDs are deduplicated per owner. Deletion of the source or destination is blocked while copying. Failed copies stay blocked, display a safe error with a route back to the original, and can be deleted from Recents. The clone action is not automatically retried after a partial commit; create a new fork if it fails. Workflow journals are cleaned up on completion.

The app retains source upload references in bounded pages, conservatively including uploads from later messages because existing references are conversation-scoped. Only the selected history prefix is copied; additional retained references do not expose later messages. References are released when the fork is deleted. Future graph-message copying will be connected with the graph feature; no graph history exists in the current app yet.

Production build, lint/type checks and development deployment passed. No account/key/provider/runtime or browser tests were run; manual verification remains pending. Notes, Graph and executable chat tools remain to port. The original Edit icon still has no source handler.

## Optional web search tool

The source globe toggle is connected to each accepted turn. Both the user's toggle and their saved Exa key are required; the server checks them before exposing the tool and resolves the active turn's owner/key again for each execution. Credentials are decrypted only in the Node tool and sent to the fixed Exa endpoint, with no shared-key fallback or plaintext history/browser storage.

The [Exa Search API](https://exa.ai/docs/reference/search) receives the same source options: five results with text limited to 5,000 characters per result. The app validates query input, bounds response bytes and fields, permits HTTP(S) result links, cancels on the turn signal/25-second timeout and returns safe failures without provider bodies. Agent persists tool calls/results and runs the source 25-step search budget. The ported reasoning timeline shows the query, result links and actionable search failures; the model can cite returned URLs. Clicking the globe without a key opens Tools settings.

Build, lint/type checks and development deployment passed. No Exa or model requests, account/key tests or browser/runtime tests were run. Ask-user interaction, memory retrieval/writes, build mode and Excalidraw remain to connect, alongside Notes and Graph.

## Ask-user interaction

The source `askUserQuestion` is registered as a model tool with no execute handler. It yields to the user with a concrete question, two to five choices and an optional write-in. Agent stores the call in conversation history; the existing composer derives its pending question from the last assistant message, so reloading or reopening the conversation restores the options. Questions and options share a bounded input parser between model validation and UI restoration.

Selecting a choice or submitting a custom answer sends the original `Q: … / A: …` text as a normal user turn. Only the accepted draft version clears; edits made during acceptance survive. Agent's version-matched history loader filters unanswered tool calls from subsequent model context, while the Q/A message retains the question and answer. The normal eight-step/source search 25-step budgets apply.

Dismiss persists the original `{ status: "cancelled" }` tool output in the same Agent order, with no new generation. Its mutation derives conversation ownership, validates the selected assistant/order/call, refuses stale questions and is idempotent after an existing result. Dismissal waits for an in-progress fork to finish so it cannot change the copied reply mid-copy. History displays a completed Question for you step rather than an indefinitely running tool.

Production build, lint/application/Convex type checks and development deployment passed. No account/key/provider/browser/runtime tests or model requests were run. Memory retrieval/writes, build mode, Excalidraw, Notes and Graph remain to port.

## Convex memory graph store

FalkorDB is replaced by Convex. The source used it only for node/edge storage, single-hop pattern matches, app-side hop-by-hop traversal, a 1536-dim cosine ANN index and atomic multi-statement writes. No graph algorithms or variable-length paths were used. `convex/memory/` maps those features as follows:

| Source (Falkor) | Convex |
| --- | --- |
| `Memory` nodes | `memories`, indexed by owner |
| `PARENT_OF` / `RELATES_TO` edges | `memoryLinks`, indexed `by_source_and_type_and_target` and `by_target_and_type` |
| `MemoryQuestion -[:FOR_MEMORY]->` + vector index | `memoryQuestions` with `by_embedding` vector index (owner filter) |
| Topology change events | Reactive `memory.topology.get` query |
| Atomic Cypher writes | Transactional internal mutations |

Vector search runs only in actions and returns similarity rather than distance, so the source 0.25 distance ceiling becomes a 0.75 similarity floor. Full-graph reads are bounded and report `truncated`. Tool-facing functions are internal and receive the owner from the calling conversation, never from model input. Writes, embeddings and search are in `convex/memory/actions.ts` (Node) and `store.ts`. Questions are embedded with the owner's saved Google key (`gemini-embedding-2`, 1536 dims) before one transactional upsert. Deletion removes questions and incident links with the Memory. Search returns source-style distance (`1 - similarity`). `convex/chat/tools/memory.ts` registers the retrieval tools on every turn and the write tools only in build mode. Owner and build mode are re-read from the stored turn on each call. The background graph-maintainer agent, its per-chat graph history and fork graph copying remain.

## Notes sidebar and detail

`src/features/notes/` ports the source family sidebar, note header, workspace and read-only Milkdown document. `useNotesTopology` subscribes to `memory.topology.get` and builds the shared forest (`shared/notes/hierarchy.ts`); `/notes/$noteId` reads `memory.topology.memoryById`. Both are reactive, so build-mode writes appear without refresh. The authenticated layout picks the sidebar body by route. Learning sessions are ported on the same note detail.

## Graph view, maintainer and Excalidraw

- `/graph` renders `src/features/graph/` (Sigma + ForceAtlas2, browser-only) over `memory.topology.get`, with a read-only inspect dialog.
- `convex/chat/graph.ts` and `graphAgent.ts` run the background graph maintainer after normal turns, store per-chat `graphMessages`, and serve the chat graph pane (`src/features/chat/graph-pane/`). Forks copy history up to the forked turn.
- `convex/chat/excalidraw.ts`, `mcpApps.ts` and `mcpAppTools.ts` connect the Excalidraw MCP server per enabled turn and cache its app resources; `src/features/chat/mcp-app/` embeds diagrams in a double sandboxed, opaque-origin iframe.
- All source features are now ported. Runtime verification and web hosting remain.
