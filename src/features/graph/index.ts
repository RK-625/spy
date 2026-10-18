/**
 * Graph feature barrel — product surface for `/graph` via SigmaCanvasHost
 * (lazy, client-only; Sigma never evaluates during SSR).
 *
 * Inside graph/* use relative imports (never this barrel — avoids cycles).
 * Do not re-export SigmaCanvas or Editor here — that pulls WebGL / Milkdown
 * into the route chunk.
 *
 * Sigma + graphology FA2 own layout + camera + draw.
 */

export { GraphPage } from './graph-page'
export { SigmaCanvasHost } from './sigma-canvas-host'
