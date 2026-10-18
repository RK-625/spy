import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/chat')({
  head: () => ({ meta: [{ title: 'Chat · SPY' }] }),
  component: () => (
    <main aria-label="Chat workspace" className="h-full min-h-0" />
  ),
})
