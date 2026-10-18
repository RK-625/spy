import { createFileRoute } from '@tanstack/react-router'

/** Notes with no note selected: blank detail; empty-forest copy lives in the sidebar. */
export const Route = createFileRoute('/_authenticated/notes/')({
  component: () => (
    <div
      role="region"
      aria-label="Notes"
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface-chat"
    />
  ),
})
