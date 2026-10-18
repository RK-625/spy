import { createFileRoute } from '@tanstack/react-router'
import { GraphPage } from '~/features/graph'

export const Route = createFileRoute('/_authenticated/graph')({
  head: () => ({ meta: [{ title: 'Graph · SPY' }] }),
  component: GraphPage,
})
