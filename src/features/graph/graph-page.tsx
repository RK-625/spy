import { SigmaCanvasHost } from './sigma-canvas-host'

/**
 * Live knowledge graph workspace (`/graph`). The client boundary is
 * SigmaCanvasHost; topology is the reactive `memory.topology.get` query.
 */
export function GraphPage() {
  return (
    <main
      aria-label="Graph workspace"
      className="relative h-full min-h-0 w-full overflow-hidden"
    >
      <SigmaCanvasHost />
    </main>
  )
}
