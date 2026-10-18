import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/')({
  component: () => <main aria-label="Workspace" className="min-h-svh" />,
})
