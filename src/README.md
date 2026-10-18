# Frontend structure

```text
src/
  routes/                  TanStack route files, loaders, and page composition
  components/
    ui/                    Shared UI primitives
    brand/                 SPY logos, custom icons, and brand assets
    workspace/             Shared sidebar and workspace navigation
  features/
    auth/                  Login page, session guard, and Convex auth provider
    providers/             User-owned key persistence and workspace integration
    landing/               Landing experience
    chat/                  Conversations, prompt, and tool displays
    notes/                 Notes hierarchy and note detail
    graph/                 Graph rendering and interaction
  lib/                     Shared utilities without feature dependencies
  styles/
    app.css                Only global stylesheet imported by the root route
    base.css               Global typography, focus, selection, and scrollbars
    theme.css              Tailwind utility mappings and the dark variant
    tokens/
      palette-light.css    Original light palette
      palette-dark.css     Original dark palette
      foundation.css       Shared dimensions, radius, and semantic aliases
      typography.css       Font files and font family tokens
      motion.ts            Original Motion transitions and animation variants
```

## Naming and imports

- Use kebab-case for authored files and folders, PascalCase for React components,
  and camelCase for functions and variables. Preserve TanStack's route filename
  conventions and generated filenames.
- Import through `~/` across domains, for example `~/lib/utils`; use relative
  imports within a domain. Import files directly rather than through barrels.
- Routes compose features and shared components. Features may use shared
  components, utilities, and tokens. Shared components and utilities must not
  import features or route modules.
- Keep feature-specific components, hooks, types, and data access inside their
  feature. Add responsibility subfolders when the feature grows; keep the
  initial structure shallow.
- Empty domain directories are tracked with `.gitkeep` until their first
  implementation. Do not add placeholder components or data services.

## Authentication routes

- `/login` is public. Its independent UI lives in
  `features/auth/login-page.tsx`; `routes/login.tsx` only composes the page and
  redirects existing sessions.
- Access is limited to existing Better Auth users with password credentials.
  Public signup, account deletion, and account linking/unlinking are disabled
  in the backend. The login page has no account-management controls; this sprint
  does not create SPY profiles or offer account provisioning.
- Put workspace routes under the pathless `_authenticated` layout. It checks
  the server-validated session before rendering and mounts the shared workspace
  shell through the provider feature. `/`, `/chat`, `/notes`, and `/graph` show
  API-key setup until required keys exist, then their feature content.
- `lib/auth-server.ts` connects server-side session checks and the same-origin
  `/api/auth/*` proxy to the existing Better Auth deployment. JWT caching stays
  disabled (the integration default), so a cookie alone never grants access.
- `features/auth/auth-provider.tsx` connects Better Auth to Convex's typed
  `ConvexProviderWithAuth` interface. It deduplicates token requests and refreshes
  tokens when Convex requests it. This avoids the integration provider's generic
  session type incompatibility with the installed Better Auth patch.
- The client guard waits for Convex authentication and rechecks the session on
  focus and every 60 seconds. Failed checks hide workspace content; ended
  sessions return to `/login`. After changing accounts or signing out, use a
  full navigation to discard the previous user's query cache. Use the exported
  `signOut()` helper in `lib/auth-client.ts` when adding a sign-out control.
- The auth server's `SITE_URL` must match the app origin (currently
  `http://localhost:3000`). Keep `VITE_CONVEX_SITE_URL` configured in the app
  environment. No browser secret is needed.
- With the local app running, `bun run test:auth` verifies guest redirects,
  forged cookies, proxy behavior, rejected credentials, origin protection, and
  disabled signup/account-management endpoints. The script reads `.env.local`
  when present; `VITE_CONVEX_SITE_URL` selects the direct backend signup check.
  Set `AUTH_TEST_URL` to test a different configured app origin.
- Route guards protect page access. Future Convex data functions must also
  validate identity and document ownership; the existing starter functions
  are not an authorization model for workspace data.

## Design tokens

The palettes and shared token values come from
[the original SPY frontend at commit 119b082](https://github.com/RK-625/spy-frontend/tree/119b08245b101a3aeabbe3e7ca1ea67cd1400878).
The Latin font files match its root layout. Preserve the source token names so
ported components can use them directly.

`app.css` imports the token layers once. The root palette is light; adding
`.dark` to `<html>` selects the dark palette and Tailwind's `dark:` variant.
The ported theme provider defaults to the source app's dark palette and stores
Light/Dark/System preferences under `spy-theme`. The sidebar toggle, command
palette, and Appearance settings all use the same theme hook.

## Workspace port

The workspace source is `RK-625/spy-frontend` at commit `119b082`. Shared chrome
is organized under `components/workspace/{sidebar,search,settings}`; routes own
authentication and pass the current Better Auth user and sign-out callback into
the shell. Shared components never import the auth feature or backend clients.
The sidebar keeps the original 56px/240px modes and `spy-sidebar-mode` storage
key. Command/Ctrl+B changes its mode; Command/Ctrl+K opens action search.

The first port covers navigation, search actions, theme preferences, General
settings and sign-out. Chat composition/history, note hierarchy/detail/learning,
and graph rendering remain to be ported. Provider/embedding/tool settings now
use encrypted, user-scoped Convex storage through `features/providers`. Only
masked key hints reach the browser after saving. Google embeddings and at least
one chat provider are required; a Google key can satisfy both.
The original SQLite, FalkorDB, and macOS keychain modules are not imported into
this Convex app. See `docs/workspace-port.md` for the remaining source map and
the provider integration used by the remaining workspace ports.

Run `bun run test:workspace:dev` to inspect the same shared UI at
`http://localhost:3016`. This is a separate Vite component fixture under
`tests/workspace`, with a synthetic identity and simulated sign-out failure.
It never imports the application router or auth client, creates no users, and
does not bypass login in the app. It is excluded from production bundling.

Use semantic utilities such as `bg-background`, `text-text-primary`,
`border-border-subtle`, `font-display`, and `px-prompt-body-x`. For canvas or
WebGL rendering, read the `--graph-*` properties from the active root styles.
Import Motion values directly from `~/styles/tokens/motion`.

Color values live only in the palette files. Typography and layout values live
in their token files. Feature styling will be ported with its owning feature;
this foundation intentionally excludes the original global widget overrides.
