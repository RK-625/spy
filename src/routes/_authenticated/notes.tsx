import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/notes')({
  head: () => ({ meta: [{ title: 'Notes · SPY' }] }),
  component: () => (
    <main aria-label="Notes workspace" className="h-full min-h-0" />
  ),
})
