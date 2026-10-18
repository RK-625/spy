import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/graph')({
  head: () => ({ meta: [{ title: 'Graph · SPY' }] }),
  component: () => (
    <main aria-label="Graph workspace" className="h-full min-h-0" />
  ),
})
