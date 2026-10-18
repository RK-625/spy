import { createFileRoute } from '@tanstack/react-router'
import { NotePage } from '~/features/notes/note-page'

export const Route = createFileRoute('/_authenticated/notes/$noteId')({
  component: NoteRoute,
})

function NoteRoute() {
  const { noteId } = Route.useParams()
  // A fresh page per note keeps document scroll and editor state per note.
  return <NotePage key={noteId} noteId={noteId} />
}
