import { useEffect, useMemo, useRef } from 'react'
import { List, TriangleAlert } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { GraphChangeFeed, parseGraphChanges } from '../feed/graph-change-feed'
import { useGraphPane } from '../state/graph-pane-state'
import type { GraphJobStatus } from '../types'
import { DotmHex9 } from '~/components/brand/dotmatrix/loaders/hex-9'
import { usePrefersReducedMotion } from '~/components/brand/dotmatrix/core/hooks'
import { Button } from '~/components/ui/actions/button'
import { ICON_GLYPH } from '~/styles/tokens/icons'
import { CHROME_FADE, GLYPH_SWAP, MOTION } from '~/styles/tokens/motion'
import { cn } from '~/lib/utils'

export const GRAPH_PANE_TRIGGER_ID = 'graph-pane-trigger'

function GraphAgentMark({
  status,
  animated,
}: {
  status: GraphJobStatus
  animated: boolean
}) {
  switch (status) {
    case 'running':
      return (
        <DotmHex9
          size={ICON_GLYPH.toolbar}
          dotSize={2.5}
          dotShape="square"
          color="currentColor"
          animated={animated}
          ariaLabel="Graph agent running"
        />
      )
    case 'failed':
      return (
        <TriangleAlert
          size={ICON_GLYPH.toolbar}
          strokeWidth={1.5}
          aria-label="Graph update failed"
        />
      )
    case 'idle':
      return <List size={ICON_GLYPH.toolbar} strokeWidth={1.5} aria-hidden />
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

export function GraphPaneAgentMark() {
  const { graph } = useGraphPane()
  const reducedMotion = usePrefersReducedMotion()
  const transition = reducedMotion ? { duration: 0 } : MOTION.chrome

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={graph.status}
        initial={reducedMotion ? { opacity: 1 } : GLYPH_SWAP.initial}
        animate={GLYPH_SWAP.animate}
        exit={reducedMotion ? { opacity: 1 } : GLYPH_SWAP.exit}
        transition={transition}
        className={cn(
          'flex items-center justify-center',
          graph.status === 'failed'
            ? 'text-destructive'
            : 'text-text-secondary',
        )}
      >
        <GraphAgentMark status={graph.status} animated={!reducedMotion} />
      </motion.span>
    </AnimatePresence>
  )
}

function GraphPaneHeader() {
  const { graph } = useGraphPane()
  const reducedMotion = usePrefersReducedMotion()
  const transition = reducedMotion ? { duration: 0 } : MOTION.chrome

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 px-4">
      <h2 className="flex-1 text-sm font-medium text-text-primary">Graph</h2>
      <AnimatePresence>
        {graph.status === 'running' ? (
          <motion.span
            key="running"
            initial={reducedMotion ? { opacity: 1 } : CHROME_FADE.initial}
            animate={CHROME_FADE.animate}
            exit={reducedMotion ? { opacity: 1 } : CHROME_FADE.exit}
            transition={transition}
            className="flex items-center justify-center text-text-secondary"
          >
            <GraphAgentMark status="running" animated={!reducedMotion} />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function GraphPaneEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm text-text-secondary">No graph yet</p>
    </div>
  )
}

export function GraphPaneShell() {
  const { open, graph } = useGraphPane()
  const changes = useMemo(
    () => parseGraphChanges(graph.messages),
    [graph.messages],
  )
  const reducedMotion = usePrefersReducedMotion()
  const transition = reducedMotion ? { duration: 0 } : MOTION.chrome
  const panelRef = useRef<HTMLElement>(null)
  const wasOpenRef = useRef(open)

  useEffect(() => {
    const wasOpen = wasOpenRef.current
    wasOpenRef.current = open
    if (open && !wasOpen) {
      panelRef.current?.focus({ preventScroll: true })
    } else if (!open && wasOpen) {
      document
        .getElementById(GRAPH_PANE_TRIGGER_ID)
        ?.focus({ preventScroll: true })
    }
  }, [open])

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.aside
          ref={panelRef}
          aria-label="Graph"
          data-graph-pane
          tabIndex={-1}
          className="absolute inset-y-0 right-0 z-30 flex w-[360px] max-w-full flex-col border-l border-[var(--border-default)] bg-[var(--surface-chat-panel)]/80 backdrop-blur-md"
          initial={
            reducedMotion
              ? CHROME_FADE.initial
              : { ...CHROME_FADE.initial, x: 32 }
          }
          animate={
            reducedMotion
              ? CHROME_FADE.animate
              : { ...CHROME_FADE.animate, x: 0 }
          }
          exit={
            reducedMotion ? CHROME_FADE.exit : { ...CHROME_FADE.exit, x: 32 }
          }
          transition={transition}
        >
          <GraphPaneHeader />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {changes.length > 0 ? (
              <GraphChangeFeed changes={changes} />
            ) : graph.canLoadMore || graph.loadingMore ? null : (
              <GraphPaneEmpty />
            )}
            {graph.canLoadMore || graph.loadingMore ? (
              <div className="flex justify-center px-4 pb-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={graph.loadingMore}
                  onClick={graph.loadMore}
                  className="text-text-secondary"
                >
                  {graph.loadingMore ? 'Loading…' : 'Show older changes'}
                </Button>
              </div>
            ) : null}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
