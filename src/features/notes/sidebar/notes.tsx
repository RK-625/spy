import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { notifyNoteNavigation } from '../navigation'
import { useNotesTopology } from '../use-notes-topology'
import { ChatSidebarNotesFamily } from './notes-family'
import type { ReactNode } from 'react'
import { usePrefersReducedMotion } from '~/components/brand/dotmatrix/core/hooks'
import { Separator } from '~/components/ui/layout/separator'
import { FAMILY_SLIDE, MOTION } from '~/styles/tokens/motion'

const FAMILY_STORAGE_KEY = 'spy-notes-family'

type FamilyNavigation = {
  familyId: string | null
  direction: 1 | -1
  focusHeading: boolean
}

function readStoredFamilyId(): string | null {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(FAMILY_STORAGE_KEY) ?? 'null',
    )
    return typeof stored === 'string' ? stored : null
  } catch {
    return null
  }
}

/** Source Notes sidebar: one PARENT_OF family at a time, sliding between levels. */
export function NotesSidebar() {
  const { topology, forest, families } = useNotesTopology()
  const navigate = useNavigate()
  const { noteId } = useParams({ strict: false })
  const selectedNoteId = noteId ?? null
  const [navigation, setNavigation] = useState<FamilyNavigation>({
    familyId: null,
    direction: 1,
    focusHeading: false,
  })
  const [familyHydrated, setFamilyHydrated] = useState(false)
  const scrollPositions = useRef(new Map<string | null, number>())
  const reducedMotion = usePrefersReducedMotion()
  const family = navigation.familyId
    ? (families.get(navigation.familyId) ?? null)
    : null
  const currentFamilyId = family?.node.note.id ?? null
  const parent = family?.parentId ? families.get(family.parentId) : null
  const parentTitle =
    parent?.node.note.name.trim() || parent?.node.note.id || 'All topics'

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setNavigation({
        familyId: readStoredFamilyId(),
        direction: 1,
        focusHeading: false,
      })
      setFamilyHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Refreshed topology rebuilds the forest. A removed family returns to the roots.
  if (topology && familyHydrated && navigation.familyId !== null && !family) {
    setNavigation({ familyId: null, direction: -1, focusHeading: false })
  }

  useEffect(() => {
    if (!topology || !familyHydrated) return
    try {
      localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(currentFamilyId))
    } catch {
      // Browser storage can be unavailable; navigation still works for this session.
    }
  }, [currentFamilyId, familyHydrated, topology])

  const handleOpenNote = useCallback(
    (id: string) => {
      notifyNoteNavigation()
      void navigate({ to: '/notes/$noteId', params: { noteId: id } })
    },
    [navigate],
  )

  const handleBrowseFamily = useCallback(
    (familyId: string | null, direction: 1 | -1) => {
      if (familyId === currentFamilyId) return
      if (
        direction === 1 &&
        (!familyId || !families.get(familyId)?.node.children.length)
      ) {
        return
      }
      setNavigation({ familyId, direction, focusHeading: true })
    },
    [currentFamilyId, families],
  )

  let body: ReactNode
  if (!topology || !familyHydrated) {
    body = (
      <div className="flex flex-1 items-center justify-center px-3">
        <span className="text-sm text-text-secondary">Loading notes…</span>
      </div>
    )
  } else if (forest.length === 0) {
    body = (
      <div className="flex flex-1 items-center justify-center px-3">
        <span className="text-center text-sm text-text-secondary">
          No notes yet. Spy weaves them as they land in the graph.
        </span>
      </div>
    )
  } else {
    body = (
      <nav
        aria-label="Note families"
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        <AnimatePresence initial={false} custom={navigation.direction}>
          <motion.div
            key={currentFamilyId ?? 'all-topics'}
            custom={navigation.direction}
            variants={FAMILY_SLIDE}
            initial={reducedMotion ? false : 'initial'}
            animate="animate"
            exit={reducedMotion ? { opacity: 0 } : 'exit'}
            transition={reducedMotion ? { duration: 0 } : MOTION.familySlide}
            className="absolute inset-0 min-h-0"
          >
            <ChatSidebarNotesFamily
              family={family}
              parentTitle={parentTitle}
              nodes={family?.node.children ?? forest}
              selectedNoteId={selectedNoteId}
              scrollPositions={scrollPositions}
              focusHeading={navigation.focusHeading}
              onOpenNote={handleOpenNote}
              onBrowseFamily={handleBrowseFamily}
            />
          </motion.div>
        </AnimatePresence>
      </nav>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="font-[family-name:var(--font-terminal)] text-[0.8125rem] font-medium uppercase tracking-[0.2em] text-text-secondary">
          Notes
        </span>
        <Separator className="h-px w-auto flex-1 bg-[var(--accent-border)]" />
      </div>
      {body}
      {topology?.truncated ? (
        <p className="px-5 pb-2 text-xs text-text-secondary">
          Showing the first part of a very large graph.
        </p>
      ) : null}
    </div>
  )
}
