import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from 'convex/react'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import { SlidersHorizontal } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Sigma from 'sigma'
import { drawDiscNodeHover } from 'sigma/rendering'
import { DEFAULT_SETTINGS } from 'sigma/settings'
import { api } from '../../../convex/_generated/api'
import { Editor } from './editor'
import {
  buildLayoutGraph,
  paintLayoutGraph,
  syncLayoutGraph,
} from './graph-functions'
import { useGraphPalette } from './graph-palette'
import type { FunctionReturnType } from 'convex/server'
import type { SigmaEdgeAttrs, SigmaGraph, SigmaNodeAttrs } from './graph-functions'
import { Button } from '~/components/ui/actions/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from '~/components/ui/overlays/dropdown-menu'
import { MOTION } from '~/styles/tokens/motion'

/** Settle the layout before Sigma draws its first frame. */
const FA2_ITERATIONS = 360
/** Settle only nodes added by a reactive update; placed nodes stay fixed. */
const FA2_SETTLE_ITERATIONS = 120
const MotionButton = motion.create(Button)

type GraphRenderer = Sigma<SigmaNodeAttrs, SigmaEdgeAttrs>
type TopologyMemory = FunctionReturnType<
  typeof api.memory.topology.get
>['memories'][number]

/** Sigma `resize()`/`refresh()` throw when the host has no layout box. */
function hostHasPositiveBox(host: HTMLElement): boolean {
  const { width, height } = host.getBoundingClientRect()
  return (
    width > 0 && height > 0 && host.offsetWidth > 0 && host.offsetHeight > 0
  )
}

function runForceAtlas2(graph: SigmaGraph, iterations: number): void {
  forceAtlas2.assign(graph, {
    iterations,
    getEdgeWeight: 'weight',
    settings: {
      ...forceAtlas2.inferSettings(graph),
      adjustSizes: true,
      edgeWeightInfluence: 1,
    },
  })
}

/** Lays out only `added`: every other node is pinned for the run. */
function settleAddedNodes(graph: SigmaGraph, added: Array<string>): void {
  if (added.length === 0) return
  const fresh = new Set(added)
  graph.updateEachNodeAttributes((id, attributes) => ({
    ...attributes,
    fixed: !fresh.has(id),
  }))
  runForceAtlas2(graph, FA2_SETTLE_ITERATIONS)
  graph.updateEachNodeAttributes((_id, { fixed: _fixed, ...attributes }) => ({
    ...attributes,
  }))
}

/** Camera easing durations; zero under reduced motion. */
function cameraDurations(reducedMotion: boolean) {
  return {
    zoomDuration: reducedMotion ? 0 : DEFAULT_SETTINGS.zoomDuration,
    inertiaDuration: reducedMotion ? 0 : DEFAULT_SETTINGS.inertiaDuration,
    doubleClickZoomingDuration: reducedMotion
      ? 0
      : DEFAULT_SETTINGS.doubleClickZoomingDuration,
  }
}

/**
 * Live knowledge graph host (graphology FA2 + Sigma).
 * Reactive Convex topology → settled FA2 layout → Sigma draw. Later updates
 * reconcile in place so placed nodes keep their positions.
 */
export function SigmaCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<GraphRenderer | null>(null)
  const relatesToVisibleRef = useRef(false)
  const [relatesToVisible, setRelatesToVisible] = useState(false)
  const topology = useQuery(api.memory.topology.get)
  const topologyRef = useRef(topology)
  const memoriesById = useMemo(
    () =>
      new Map<string, TopologyMemory>(
        topology?.memories.map((memory) => [memory.id, memory]),
      ),
    [topology],
  )
  const memoriesByIdRef = useRef(memoriesById)
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null)
  const selectedNode =
    selectedMemoryId === null
      ? null
      : (memoriesById.get(selectedMemoryId) ?? null)

  if (
    topology !== undefined &&
    selectedMemoryId !== null &&
    selectedNode === null
  ) {
    setSelectedMemoryId(null)
  }

  const reducedMotion = useReducedMotion() ?? false
  const reducedMotionRef = useRef(reducedMotion)
  const graphPalette = useGraphPalette()
  const graphPaletteRef = useRef(graphPalette)
  const isGraphPaletteReady = graphPalette !== null
  const hasMemories = (topology?.memories.length ?? 0) > 0

  // Topology update: reconcile the mounted graph without relaying it out.
  useEffect(() => {
    topologyRef.current = topology
    memoriesByIdRef.current = memoriesById
    const renderer = rendererRef.current
    const palette = graphPaletteRef.current
    if (renderer == null || palette == null || topology == null) return
    const graph = renderer.getGraph()
    const added = syncLayoutGraph(
      graph,
      topology.memories,
      topology.links,
      palette,
    )
    settleAddedNodes(graph, added)
    renderer.refresh()
  }, [topology, memoriesById])

  // Theme change: recolor the mounted graph in place, keeping its settled layout.
  useEffect(() => {
    graphPaletteRef.current = graphPalette
    const renderer = rendererRef.current
    if (renderer == null || graphPalette == null) return
    paintLayoutGraph(renderer.getGraph(), graphPalette)
    renderer.setSetting('defaultNodeColor', graphPalette.node)
    renderer.refresh()
  }, [graphPalette])

  useEffect(() => {
    reducedMotionRef.current = reducedMotion
    const renderer = rendererRef.current
    if (renderer == null) return
    for (const [key, value] of Object.entries(cameraDurations(reducedMotion))) {
      renderer.setSetting(
        key as keyof ReturnType<typeof cameraDurations>,
        value,
      )
    }
  }, [reducedMotion])

  useEffect(() => {
    relatesToVisibleRef.current = relatesToVisible
    rendererRef.current?.refresh()
  }, [relatesToVisible])

  useEffect(() => {
    const host = hostRef.current
    if (host == null || !hasMemories || !isGraphPaletteReady) return

    let cancelled = false
    let renderer: GraphRenderer | null = null

    const mount = () => {
      if (cancelled || renderer != null) return
      const palette = graphPaletteRef.current
      const current = topologyRef.current
      if (!hostHasPositiveBox(host) || palette == null || current == null) {
        return
      }

      const graph = buildLayoutGraph(current.memories, current.links, palette)
      runForceAtlas2(graph, FA2_ITERATIONS)
      const instance = new Sigma(graph, host, {
        defaultNodeColor: palette.node,
        renderLabels: false,
        defaultDrawNodeHover: (context, data, settings) =>
          drawDiscNodeHover(context, { ...data, label: null }, settings),
        itemSizesReference: 'screen',
        minEdgeThickness: 0,
        autoRescale: true,
        autoCenter: true,
        minCameraRatio: 0.3,
        defaultEdgeType: 'line',
        edgeReducer: (_edge, attributes) => ({
          ...attributes,
          hidden:
            attributes.relationType === 'RELATES_TO' &&
            !relatesToVisibleRef.current,
        }),
        allowInvalidContainer: false,
        ...cameraDurations(reducedMotionRef.current),
      })
      instance.on('clickNode', ({ node }) => {
        const memory = memoriesByIdRef.current.get(node)
        if (memory == null) return
        setSelectedMemoryId(memory.id)
      })
      renderer = instance
      rendererRef.current = instance
    }

    const syncSigmaToHostBox = () => {
      if (cancelled) return
      if (renderer != null) {
        if (!hostHasPositiveBox(host)) return
        renderer.resize()
        renderer.refresh()
        return
      }
      mount()
    }

    syncSigmaToHostBox()
    const observer = new ResizeObserver(syncSigmaToHostBox)
    observer.observe(host)

    return () => {
      cancelled = true
      observer.disconnect()
      renderer?.kill()
      rendererRef.current = null
    }
  }, [hasMemories, isGraphPaletteReady])

  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-text-primary">
      <div
        ref={hostRef}
        className="absolute inset-0 bg-[var(--graph-canvas)]"
        aria-label="Knowledge graph canvas. Click a node to inspect. Drag to pan, wheel to zoom."
      />

      {topology !== undefined && !hasMemories ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <p className="max-w-xs text-center text-sm text-text-secondary">
            No memories yet. Chat to start weaving your graph.
          </p>
        </div>
      ) : null}

      {topology?.truncated ? (
        <div
          role="status"
          className="absolute top-3 right-3 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/90 px-2.5 py-1 text-xs text-text-secondary backdrop-blur-sm sm:top-4 sm:right-4"
        >
          Showing part of your graph
        </div>
      ) : null}

      {selectedNode ? (
        <Editor
          key={selectedNode.id}
          node={selectedNode}
          onClose={() => setSelectedMemoryId(null)}
        />
      ) : null}

      <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <MotionButton
              variant="outline"
              size="icon-sm"
              aria-label="Graph display options"
              title="Graph display options"
              whileTap={reducedMotion ? undefined : { opacity: 0.7 }}
              transition={MOTION.chrome}
            >
              <SlidersHorizontal strokeWidth={1.5} />
            </MotionButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-auto min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuCheckboxItem
                checked={relatesToVisible}
                onCheckedChange={setRelatesToVisible}
              >
                Show related connections
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default SigmaCanvas
