import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { X } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { getNotePath } from '../../../shared/notes/hierarchy'
import { NoteDocument } from './document/note-document'
import { NoteHeader } from './note-header'
import { useNotesTopology } from './use-notes-topology'
import type { ReactNode } from 'react'
import { Button } from '~/components/ui/actions/button'
import { DotmHex9 } from '~/components/brand/dotmatrix/loaders/hex-9'

/** Source note chrome; Escape returns to the Notes index. */
export function NoteWorkspace({
  children,
  header,
}: {
  children: ReactNode
  header?: ReactNode
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

/**
 * Read-only note at `/notes/$noteId`. The body is reactive: graph writes in
 * build mode update the open note and its breadcrumb. Unknown or foreign ids
 * stay on this route as "Note not found".
 */
export function NotePage({ noteId }: { noteId: string }) {
  const note = useQuery(api.memory.topology.memoryById, { id: noteId })
  const { families } = useNotesTopology()

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

  const livePath = getNotePath(families, note.id)
  return (
    <NoteWorkspace
      header={<NoteHeader path={livePath.length ? livePath : [note]} />}
    >
      <div
        role="region"
        tabIndex={-1}
        aria-label="Note document"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4 outline-none"
      >
        <NoteDocument node={note} />
      </div>
    </NoteWorkspace>
  )
}
