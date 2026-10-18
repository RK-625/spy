import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { useGraphHistory } from '../use-graph-history'

type GraphPaneContextValue = {
  open: boolean
  toggleGraphPane: () => void
  graph: ReturnType<typeof useGraphHistory>
}

const GraphPaneContext = createContext<GraphPaneContextValue | null>(null)

export function GraphPaneProvider({
  graph,
  children,
}: {
  graph: ReturnType<typeof useGraphHistory>
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  const toggleGraphPane = useCallback(() => {
    setOpen((previous) => !previous)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (document.querySelector('[role="dialog"]')) return
      setOpen(false)
    }
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-graph-pane]')) return
      if (
        target.closest(
          'button, a, input, textarea, select, [role="button"], [contenteditable="true"]',
        )
      )
        return
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed) return
      setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('click', handleOutsideClick)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('click', handleOutsideClick)
    }
  }, [open])

  const value = useMemo(
    () => ({ open, toggleGraphPane, graph }),
    [open, toggleGraphPane, graph],
  )

  return (
    <GraphPaneContext.Provider value={value}>
      {children}
    </GraphPaneContext.Provider>
  )
}

export function useGraphPane(): GraphPaneContextValue {
  const value = useContext(GraphPaneContext)
  if (!value)
    throw new Error('useGraphPane must be used within GraphPaneProvider')
  return value
}
