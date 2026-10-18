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
- Put workspace routes under the pathless `_authenticated` layout. It checks
  the server-validated session before rendering. `/` is intentionally blank.
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
  forged cookies, proxy behavior, rejected credentials, and origin protection.
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
Theme preference controls and persistence belong to a later implementation.

Use semantic utilities such as `bg-background`, `text-text-primary`,
`border-border-subtle`, `font-display`, and `px-prompt-body-x`. For canvas or
WebGL rendering, read the `--graph-*` properties from the active root styles.
Import Motion values directly from `~/styles/tokens/motion`.

Color values live only in the palette files. Typography and layout values live
in their token files. Feature styling will be ported with its owning feature;
this foundation intentionally excludes the original global widget overrides.
