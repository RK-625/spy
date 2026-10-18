import { MultiDirectedGraph } from 'graphology'

/** Structural link shape shared by the Convex topology and the canvas. */
export type Links = {
  source: string
  target: string
  type: 'PARENT_OF' | 'RELATES_TO'
}

/** Fields the canvas reads; any lean or full Memory row satisfies it. */
export type GraphMemory = { id: string; name: string }

/** Theme colors for the graph, read from the palette tokens (src/styles/tokens). */
export interface GraphPalette {
  /** Nodes outside any PARENT_OF domain. */
  node: string
  linkParentOf: string
  linkRelatesTo: string
  /** HSL lightness of a domain root; each rank moves by `nodeLightnessStep` until `nodeLightnessLimit`. */
  nodeLightnessRoot: number
  nodeLightnessStep: number
  nodeLightnessLimit: number
}
/** FA2 edge weight for RELATES_TO (not a layout spring). */
export const RELATES_FA2_WEIGHT = 0
export const EDGE_SIZE = 1

export interface SigmaNodeAttrs {
  x: number
  y: number
  size: number
  color: string
  label: string
  /** FA2 leaves fixed nodes in place; set only while new nodes settle. */
  fixed?: boolean
}

export interface SigmaEdgeAttrs {
  relationType: Links['type']
  color: string
  size: number
  type: 'line'
  weight: number
}

/** Multi so PARENT_OF + RELATES_TO can share a directed pair. */
export type SigmaGraph = MultiDirectedGraph<SigmaNodeAttrs, SigmaEdgeAttrs>

export type NodeHierarchy = {
  ranks: Map<string, number>
  /** Domain apex. `null` = no PARENT_OF. Domain root maps to itself. */
  rootById: Map<string, string | null>
}

type Walk = { rank: number; rootId: string | null }

/** PARENT_OF only. Parent → child. First parent wins. */
export function findNodeRanks(
  nodeIds: ReadonlyArray<string>,
  links: ReadonlyArray<Links>,
): NodeHierarchy {
  const parentByChild = new Map<string, string>()
  const isParent = new Set<string>()
  for (const { type, source, target } of links) {
    if (type !== 'PARENT_OF') continue
    isParent.add(source)
    if (!parentByChild.has(target)) parentByChild.set(target, source)
  }

  const ranks = new Map<string, number>()
  const rootById = new Map<string, string | null>()

  const walk = (id: string, trail: Set<string>): Walk => {
    if (rootById.has(id)) {
      return { rank: ranks.get(id) ?? 0, rootId: rootById.get(id) ?? null }
    }
    if (trail.has(id)) {
      ranks.set(id, 0)
      rootById.set(id, id)
      return { rank: 0, rootId: id }
    }
    const parentId = parentByChild.get(id)
    if (parentId == null) {
      const rootId = isParent.has(id) ? id : null
      ranks.set(id, 0)
      rootById.set(id, rootId)
      return { rank: 0, rootId }
    }
    trail.add(id)
    const parent = walk(parentId, trail)
    trail.delete(id)
    const rank = parent.rank + 1
    const rootId = parent.rootId ?? parentId
    ranks.set(id, rank)
    rootById.set(id, rootId)
    return { rank, rootId }
  }

  for (const id of nodeIds) walk(id, new Set())
  return { ranks, rootById }
}

/** Same PARENT_OF root → same hue. Deeper rank → toward the canvas. No root → palette node color. */
export function findNodeColors(
  { ranks, rootById }: NodeHierarchy,
  palette: GraphPalette,
): Map<string, string> {
  const colors = new Map<string, string>()
  for (const [id, rootId] of rootById) {
    colors.set(
      id,
      rootId == null
        ? palette.node
        : shade(hueOf(rootId), ranks.get(id) ?? 0, palette),
    )
  }
  return colors
}

/**
 * Node sizes are screen pixels for Sigma. Rank weight alone (0–1) would
 * render as sub-pixel dots — scale to readable screen pixels.
 * Root largest; deeper ranks smaller.
 */
export const POINT_SIZE_BASE_PX = 15

/** Root ≈ POINT_SIZE_BASE_PX; deeper → smaller (rank 1 ≈ 4, rank 2 ≈ 2.67, …). */
export function sizeFromRank(rank: number): number {
  return POINT_SIZE_BASE_PX / (rank + 1)
}

/** PARENT_OF spring from child rank. Inverse of parent+child size pair; no cap. Rank 1 ≈ 0.67; deeper → stronger. */
export function strengthFromChildRank(childRank: number): number {
  const r = Math.max(1, childRank)
  return (r * (r + 1)) / (2 * r + 1)
}

export function findNodeSizes({ ranks }: NodeHierarchy): Map<string, number> {
  const sizes = new Map<string, number>()
  for (const [id, rank] of ranks) sizes.set(id, sizeFromRank(rank))
  return sizes
}

function hashOf(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function hueOf(id: string): number {
  const h = hashOf(id) % 334
  return h >= 32 ? h + 26 : h
}

function shade(h: number, rank: number, palette: GraphPalette): string {
  const { nodeLightnessRoot, nodeLightnessStep, nodeLightnessLimit } = palette
  const rankLightness = nodeLightnessRoot + rank * nodeLightnessStep
  const l =
    nodeLightnessStep < 0
      ? Math.max(nodeLightnessLimit, rankLightness)
      : Math.min(nodeLightnessLimit, rankLightness)
  const a = 0.54 * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function findLinkColor(type: Links['type'], palette: GraphPalette): string {
  return type === 'PARENT_OF' ? palette.linkParentOf : palette.linkRelatesTo
}

/** Edge key: source + target + link type (exact-duplicate guard). */
function layoutEdgeKey(link: Links): string {
  return `${link.source}\0${link.target}\0${link.type}`
}

/** Circle-seeded topology — the canvas settles FA2 before Sigma mounts. */
export function buildLayoutGraph(
  memories: ReadonlyArray<GraphMemory>,
  links: ReadonlyArray<Links>,
  palette: GraphPalette,
): SigmaGraph {
  const graph = new MultiDirectedGraph<SigmaNodeAttrs, SigmaEdgeAttrs>()
  const ids = memories.map((memory) => memory.id)
  const hierarchy = findNodeRanks(ids, links)
  const colors = findNodeColors(hierarchy, palette)
  const sizes = findNodeSizes(hierarchy)
  const count = memories.length
  memories.forEach((memory, index) => {
    const angle = (2 * Math.PI * index) / Math.max(count, 1)
    graph.addNode(memory.id, {
      x: Math.cos(angle),
      y: Math.sin(angle),
      size: sizes.get(memory.id) ?? 1,
      color: colors.get(memory.id) ?? palette.node,
      label: memory.name,
    })
  })
  for (const link of links) {
    if (!graph.hasNode(link.source) || !graph.hasNode(link.target)) continue
    const edgeKey = layoutEdgeKey(link)
    if (graph.hasEdge(edgeKey)) continue
    const isParentOf = link.type === 'PARENT_OF'
    graph.addEdgeWithKey(edgeKey, link.source, link.target, {
      relationType: link.type,
      color: findLinkColor(link.type, palette),
      size: EDGE_SIZE,
      type: 'line',
      weight: isParentOf
        ? strengthFromChildRank(hierarchy.ranks.get(link.target) ?? 1)
        : RELATES_FA2_WEIGHT,
    })
  }

  return graph
}

/** Recolors a built graph in place (theme change) without touching its layout. */
export function paintLayoutGraph(
  graph: SigmaGraph,
  palette: GraphPalette,
): void {
  const links = graph.mapEdges(
    (_edge, attributes, source, target): Links => ({
      source,
      target,
      type: attributes.relationType,
    }),
  )
  const colors = findNodeColors(findNodeRanks(graph.nodes(), links), palette)
  graph.updateEachNodeAttributes((id, attributes) => ({
    ...attributes,
    color: colors.get(id) ?? palette.node,
  }))
  graph.updateEachEdgeAttributes((_edge, attributes) => ({
    ...attributes,
    color: findLinkColor(attributes.relationType, palette),
  }))
}

/** Deterministic unit offset so seeded nodes never sit exactly on a neighbor. */
function jitterOf(id: string): { dx: number; dy: number } {
  const angle = ((hashOf(id) % 3600) / 3600) * 2 * Math.PI
  return { dx: Math.cos(angle), dy: Math.sin(angle) }
}

/**
 * Reconciles a mounted graph with a new topology in place, keeping every
 * surviving node where it is. Removed nodes and edges drop; sizes, colors and
 * labels refresh; new nodes are seeded beside their already placed neighbors
 * (or on a ring outside the current layout). Returns the added node ids so the
 * caller can settle only those.
 */
export function syncLayoutGraph(
  graph: SigmaGraph,
  memories: ReadonlyArray<GraphMemory>,
  links: ReadonlyArray<Links>,
  palette: GraphPalette,
): Array<string> {
  const next = buildLayoutGraph(memories, links, palette)

  for (const id of graph.nodes()) {
    if (!next.hasNode(id)) graph.dropNode(id)
  }
  for (const edge of graph.edges()) {
    if (!next.hasEdge(edge)) graph.dropEdge(edge)
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  graph.forEachNode((_id, { x, y }) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  })
  const hasPlaced = graph.order > 0
  const centerX = hasPlaced ? (minX + maxX) / 2 : 0
  const centerY = hasPlaced ? (minY + maxY) / 2 : 0
  const extent = hasPlaced ? Math.max(maxX - minX, maxY - minY, 1) : 1
  const spacing = extent * 0.05

  const added: Array<string> = []
  next.forEachNode((id, attributes) => {
    if (graph.hasNode(id)) {
      graph.mergeNodeAttributes(id, {
        size: attributes.size,
        color: attributes.color,
        label: attributes.label,
      })
      return
    }
    added.push(id)
  })

  // Seed against nodes that were already placed, before any new node lands.
  const seeds = added.map((id) => {
    let sumX = 0
    let sumY = 0
    let placed = 0
    next.forEachNeighbor(id, (neighbor) => {
      if (!graph.hasNode(neighbor)) return
      sumX += graph.getNodeAttribute(neighbor, 'x')
      sumY += graph.getNodeAttribute(neighbor, 'y')
      placed++
    })
    const { dx, dy } = jitterOf(id)
    if (placed > 0) {
      return {
        id,
        x: sumX / placed + dx * spacing,
        y: sumY / placed + dy * spacing,
      }
    }
    const radius = hasPlaced ? extent * 0.6 : 1
    return { id, x: centerX + dx * radius, y: centerY + dy * radius }
  })
  for (const { id, x, y } of seeds) {
    graph.addNode(id, { ...next.getNodeAttributes(id), x, y })
  }

  next.forEachEdge((edge, attributes, source, target) => {
    if (graph.hasEdge(edge)) {
      graph.mergeEdgeAttributes(edge, {
        color: attributes.color,
        weight: attributes.weight,
      })
      return
    }
    graph.addEdgeWithKey(edge, source, target, { ...attributes })
  })

  return added
}
