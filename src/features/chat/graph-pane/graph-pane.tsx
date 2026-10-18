import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { GraphPaneProvider, useGraphPane } from './state/graph-pane-state'
import {
  GRAPH_PANE_TRIGGER_ID,
  GraphPaneAgentMark,
  GraphPaneShell,
} from './shell/graph-pane-shell'
import { useGraphHistory } from './use-graph-history'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '~/components/ui/actions/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/overlays/tooltip'

function GraphPaneRailTrigger() {
  const { open, toggleGraphPane } = useGraphPane()
  if (open) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-expanded={open}
          aria-label="Open graph pane"
          className="absolute top-4 right-4 z-30 text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground"
          id={GRAPH_PANE_TRIGGER_ID}
          onClick={toggleGraphPane}
          size="icon"
          type="button"
          variant="ghost"
        >
          <GraphPaneAgentMark />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">Open graph pane</TooltipContent>
    </Tooltip>
  )
}

/** Source graph pane: a rail mark for maintainer status and a change feed over this chat's graph history. */
export function GraphPane({
  conversationId,
}: {
  conversationId: Id<'conversations'> | undefined
}) {
  const graph = useGraphHistory(conversationId)
  const previousStatusRef = useRef(graph.status)
  const previousChatIdRef = useRef(conversationId)

  // Toast only after this same chat was running and then failed. Opening an
  // older failed chat stays quiet; the rail mark still shows that failure.
  useEffect(() => {
    const previousStatus = previousStatusRef.current
    const sameChat = previousChatIdRef.current === conversationId
    previousStatusRef.current = graph.status
    previousChatIdRef.current = conversationId
    if (sameChat && previousStatus === 'running' && graph.status === 'failed')
      toast.error('Graph update failed', {
        description:
          'Chat is unaffected. Some changes from this turn may not be saved.',
      })
  }, [conversationId, graph.status])

  return (
    <GraphPaneProvider graph={graph}>
      <GraphPaneRailTrigger />
      <GraphPaneShell />
    </GraphPaneProvider>
  )
}
