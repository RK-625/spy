import { Suspense, lazy, useEffect, useState } from 'react'

/**
 * Client-only Sigma mount. Sigma touches WebGL at import time
 * (`WebGL2RenderingContext`), which does not exist during SSR, so the module
 * is imported only after mount; the server renders the blank canvas.
 */
const SigmaCanvas = lazy(() => import('./sigma-canvas'))

function CanvasPlaceholder() {
  return <div className="h-full w-full bg-[var(--graph-canvas)]" />
}

export function SigmaCanvasHost() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <CanvasPlaceholder />
  return (
    <Suspense fallback={<CanvasPlaceholder />}>
      <SigmaCanvas />
    </Suspense>
  )
}
