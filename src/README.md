# Frontend structure

```text
src/
  routes/                  TanStack route files, loaders, and page composition
  components/
    ui/                    Shared UI primitives
    brand/                 SPY logos, custom icons, and brand assets
    workspace/             Shared sidebar and workspace navigation
  features/
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
