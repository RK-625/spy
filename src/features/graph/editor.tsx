import { Suspense, lazy, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Book, X } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '~/components/ui/actions/button'
import { Spinner } from '~/components/ui/feedback/spinner'
import {
  DialogClose as EditorClose,
  DialogContent as EditorContent,
  DialogDescription as EditorDescription,
  Dialog as EditorDialog,
  DialogHeader as EditorHeader,
  DialogTitle as EditorTitle,
} from '~/components/ui/overlays/dialog'
import { ICON_GLYPH } from '~/styles/tokens/icons'

const MilkdownView = lazy(
  () => import('~/features/notes/document/milkdown-view'),
)

/** The lean topology row the canvas selected; the body is fetched here. */
export type EditorNode = {
  id: Id<'memories'>
  name: string
  confidence: number
}

export type EditorProps = {
  node: EditorNode
  onClose: () => void
}

function formatConfidence(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return `${pct}%`
}

function DocumentLoading() {
  return (
    <div className="flex items-center py-4">
      <Spinner aria-label="Loading document" />
    </div>
  )
}

/**
 * Memory inspect overlay — dark utility register, lavender accents.
 * Mount only when a node is selected; close clears that selection.
 * Read-only: the graph has no persisted edit path.
 */
export function Editor({ node, onClose }: EditorProps) {
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // Reactive body; undefined while loading, null once the memory is gone.
  const body = useQuery(api.memory.topology.memoryById, { id: node.id })
  const title = (body?.name ?? node.name).trim() || node.id || 'Node'
  const content =
    body?.content.trim() || `No content woven for “${title}” yet.`
  const impression = body?.impression.trim() ?? ''
  const confidenceLabel = formatConfidence(body?.confidence ?? node.confidence)

  return (
    <EditorDialog
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      open
    >
      <EditorContent
        className="flex h-[min(88dvh,56rem)] w-[min(92vw,88rem)] max-w-none flex-col gap-3 overflow-hidden rounded-[var(--radius)] border-[var(--border-medium)] bg-[var(--surface-elevated)]/95 backdrop-blur-md sm:max-w-none"
        showCloseButton={false}
      >
        <EditorHeader className="shrink-0 flex-row items-center gap-3">
          <EditorTitle className="min-w-0 flex-1 truncate font-[family-name:var(--font-terminal)] text-lg tracking-widest text-primary uppercase">
            {title}
          </EditorTitle>
          <EditorDescription className="sr-only">
            Read-only memory note
          </EditorDescription>
          {confidenceLabel ? (
            <span className="shrink-0 font-mono text-sm text-primary">
              {confidenceLabel}
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Open note"
            onClick={() =>
              void navigate({
                to: '/notes/$noteId',
                params: { noteId: node.id },
              })
            }
          >
            <Book size={ICON_GLYPH.inline} strokeWidth={1.5} />
            Open note
          </Button>
          <EditorClose asChild>
            <Button variant="ghost" className="bg-secondary" size="icon-sm">
              <X size={ICON_GLYPH.inline} strokeWidth={1.5} />
              <span className="sr-only">Close</span>
            </Button>
          </EditorClose>
        </EditorHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 text-sm">
          <div className="flex min-h-0 flex-1 flex-col rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3">
            {/* Milkdown and Shiki are browser-only; the body loads reactively. */}
            {mounted && body !== undefined ? (
              <Suspense fallback={<DocumentLoading />}>
                <MilkdownView
                  key={`${node.id}:${content}`}
                  documentText={content}
                  readOnly={true}
                />
              </Suspense>
            ) : (
              <DocumentLoading />
            )}
          </div>

          {impression ? (
            <div className="shrink-0 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3">
              <div className="mb-1.5 text-[0.7rem] tracking-wider text-text-secondary uppercase">
                Impression
              </div>
              <p className="max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed text-text-primary">
                {impression}
              </p>
            </div>
          ) : null}
        </div>
      </EditorContent>
    </EditorDialog>
  )
}
