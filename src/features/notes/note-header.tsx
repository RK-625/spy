import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { getNoteTitle } from '../../../shared/notes/hierarchy'
import type { ReactNode } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/navigation/breadcrumb'
import { Button } from '~/components/ui/actions/button'

type PathNote = { id: string; name: string }

/** Source note header: family breadcrumb, actions slot and close. */
export function NoteHeader({
  path,
  actions,
}: {
  path: Array<PathNote>
  actions?: ReactNode
}) {
  return (
    <header
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 pt-6 pb-4"
      data-note-header
    >
      <Breadcrumb className="min-w-0 flex-1 basis-64">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/notes">Notes</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {path.map((note, index) => (
            <Fragment key={note.id}>
              <BreadcrumbSeparator>/</BreadcrumbSeparator>
              <BreadcrumbItem className="min-w-0 wrap-anywhere">
                {index === path.length - 1 ? (
                  <BreadcrumbPage>{getNoteTitle(note)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to="/notes/$noteId" params={{ noteId: note.id }}>
                      {getNoteTitle(note)}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2 text-sm">
        {actions}
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="note-control"
          aria-label="Close note"
        >
          <Link to="/notes">
            <X aria-hidden="true" strokeWidth={1.5} />
          </Link>
        </Button>
      </div>
    </header>
  )
}
