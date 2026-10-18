import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { api } from '../../../convex/_generated/api'
import {
  getNotePath,
  getNoteTitle,
  indexNotesFamilies,
} from '../../../shared/notes/hierarchy'
import { NoteDocument } from './document/note-document'
import { NoteHeader } from './note-header'
import { NOTE_NAVIGATION_EVENT } from './navigation'
import { useNotesTopology } from './use-notes-topology'
import {
  LearningSummaryFooter,
  NoteLearningActions,
} from './learning/learning-actions'
import {
  LearningNavigation,
  LearningProgress,
} from './learning/learning-navigation'
import { LearningSummary } from './learning/learning-summary'
import {
  createNoteLearningSnapshot,
  getNoteLearningCounts,
  noteLearningReducer,
} from './learning/session'
import type { ReactNode } from 'react'
import { Button } from '~/components/ui/actions/button'
import { DotmHex9 } from '~/components/brand/dotmatrix/loaders/hex-9'
import { FAMILY_SLIDE, MOTION } from '~/styles/tokens/motion'

/** Source note chrome; Escape returns to the Notes index. */
export function NoteWorkspace({
  children,
  header,
  footer,
}: {
  children: ReactNode
  header?: ReactNode
  footer?: ReactNode
}) {
  const navigate = useNavigate()
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && event.key === 'Escape')
        void navigate({ to: '/notes' })
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])
  return (
    <div
      role="region"
      aria-label="Note"
      className="@container relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface-chat"
    >
      {header ?? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="note-control absolute top-6 right-6 z-10"
          onClick={() => void navigate({ to: '/notes' })}
          aria-label="Close note"
        >
          <X aria-hidden="true" strokeWidth={1.5} />
        </Button>
      )}
      {children}
      {footer}
    </div>
  )
}

function NoteStatus({
  ariaLabel,
  children,
}: {
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <NoteWorkspace>
      <div
        role="status"
        aria-label={ariaLabel}
        className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-8"
      >
        {children}
      </div>
    </NoteWorkspace>
  )
}

type NoteBody = {
  id: string
  name: string
  content: string
  impression: string
  confidence: number
}

/** Loads one session card's body; the snapshot only keeps lean identities. */
function LearningCard({ noteId }: { noteId: string }) {
  const note = useQuery(api.memory.topology.memoryById, { id: noteId })
  if (note === undefined)
    return (
      <div
        role="status"
        aria-label="Loading note"
        className="flex items-center justify-center py-8"
      >
        <DotmHex9 animated={true} />
      </div>
    )
  if (note === null)
    return <p className="text-sm text-text-secondary">Note not found.</p>
  return <NoteDocument node={note} />
}

/**
 * Read-only note at `/notes/$noteId` with an optional local Learn session over
 * the note's family. The body is reactive: graph writes in build mode update
 * the open note and its breadcrumb. Unknown or foreign ids stay on this route
 * as "Note not found". Learning state is discarded on unmount.
 */
export function NotePage({ noteId }: { noteId: string }) {
  const note = useQuery(api.memory.topology.memoryById, { id: noteId })
  if (note === undefined)
    return (
      <NoteStatus ariaLabel="Loading note">
        <DotmHex9 animated={true} />
      </NoteStatus>
    )
  if (note === null)
    return (
      <NoteStatus ariaLabel="Note not found">
        <p className="text-sm text-text-secondary">Note not found.</p>
      </NoteStatus>
    )
  return <NoteReadyBody node={note} />
}

function NoteReadyBody({ node }: { node: NoteBody }) {
  const { topology, families } = useNotesTopology()
  const loading = topology === undefined
  const availableCount = useMemo(() => {
    const selectedFamily = families.get(node.id)
    return selectedFamily
      ? indexNotesFamilies([selectedFamily.node]).size
      : null
  }, [families, node.id])
  const [session, dispatch] = useReducer(noteLearningReducer, null)
  useEffect(() => {
    const resetSession = () => dispatch({ type: 'exit' })
    window.addEventListener(NOTE_NAVIGATION_EVENT, resetSession)
    return () => window.removeEventListener(NOTE_NAVIGATION_EVENT, resetSession)
  }, [])
  const reduceMotion = useReducedMotion()
  const scrollContainer = useRef<HTMLDivElement>(null)
  const counts = session ? getNoteLearningCounts(session) : null
  const currentId = session
    ? session.mode === 'revisit'
      ? session.revisitedNoteId!
      : session.snapshot.cardIds[session.currentIndex]
    : node.id
  const currentTitle = session
    ? getNoteTitle(session.snapshot.notes.get(currentId)!)
    : getNoteTitle(node)
  const summary = session?.mode === 'completed'
  const displayedId = summary ? session.snapshot.rootId : currentId
  const livePath = getNotePath(families, node.id)
  const path = session
    ? session.snapshot.paths.get(displayedId)!
    : livePath.length
      ? livePath
      : [node]
  const viewKey = `${session?.mode ?? 'document'}:${displayedId}`
  const startSession = () => {
    const snapshot = createNoteLearningSnapshot(families, node.id)
    if (snapshot) dispatch({ type: 'start', snapshot })
  }
  useEffect(() => {
    scrollContainer.current?.scrollTo({ top: 0, behavior: 'instant' })
    if (summary || session?.mode === 'revisit')
      scrollContainer.current?.focus({ preventScroll: true })
  }, [viewKey, summary, session?.mode])

  const headerActions = (
    <NoteLearningActions
      session={session}
      availableCount={availableCount}
      loading={loading}
      onStart={startSession}
      dispatch={dispatch}
    />
  )
  const footer =
    session?.mode === 'active' ? (
      <LearningNavigation
        firstCard={session.currentIndex === 0}
        processed={counts!.processed}
        total={counts!.total}
        onPrevious={() => dispatch({ type: 'previous' })}
        onDecide={(outcome) => dispatch({ type: 'decide', outcome })}
      />
    ) : summary ? (
      <LearningSummaryFooter
        processed={counts!.processed}
        total={counts!.total}
        canRestart={Boolean(availableCount)}
        onRestart={startSession}
      />
    ) : undefined
  return (
    <NoteWorkspace
      header={<NoteHeader path={path} actions={headerActions} />}
      footer={footer}
    >
      {session ? (
        <LearningProgress processed={counts!.processed} total={counts!.total} />
      ) : null}
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {summary
          ? `Session complete. ${counts!.reviewed} reviewed, ${counts!.skipped} skipped.`
          : session
            ? `${session.mode === 'active' ? `Note ${session.currentIndex + 1} of ${counts!.total}.` : 'Revisiting.'} ${currentTitle}`
            : ''}
      </p>
      <div
        role="region"
        ref={scrollContainer}
        tabIndex={-1}
        aria-label={summary ? 'Session summary' : 'Note document'}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4 outline-none"
      >
        <AnimatePresence
          initial={false}
          mode="wait"
          custom={session?.direction ?? 1}
          onExitComplete={() =>
            scrollContainer.current?.scrollTo({ top: 0, behavior: 'instant' })
          }
        >
          <motion.div
            key={viewKey}
            custom={session?.direction ?? 1}
            variants={reduceMotion ? undefined : FAMILY_SLIDE}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={reduceMotion ? { duration: 0 } : MOTION.familySlide}
          >
            {summary ? (
              <LearningSummary
                session={session}
                reviewed={counts!.reviewed}
                skipped={counts!.skipped}
                onExpand={(id, expanded) =>
                  dispatch({ type: 'expand', noteId: id, expanded })
                }
                onRevisit={(id) => dispatch({ type: 'revisit', noteId: id })}
              />
            ) : session ? (
              <LearningCard noteId={currentId} />
            ) : (
              <NoteDocument node={node} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </NoteWorkspace>
  )
}
