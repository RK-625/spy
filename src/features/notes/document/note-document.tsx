import { Suspense, lazy, useEffect, useState } from 'react'
import { Spinner } from '~/components/ui/feedback/spinner'

const MilkdownView = lazy(() => import('./milkdown-view'))

type NoteBody = {
  id: string
  name: string
  content: string
  impression: string
  confidence: number
}

function formatConfidence(value: number): string | null {
  if (!Number.isFinite(value)) return null
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`
}

function DocumentLoading() {
  return (
    <div className="flex items-center py-4">
      <Spinner aria-label="Loading document" />
    </div>
  )
}

/** Source ready document: title, read-only Milkdown, impression. */
export function NoteDocument({ node }: { node: NoteBody }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const title = node.name.trim() || node.id || 'Note'
  const confidenceLabel = formatConfidence(node.confidence)
  const documentText =
    node.content.trim() || `No content woven for “${title}” yet.`
  const impression = node.impression.trim()

  return (
    <>
      <header className="flex shrink-0 items-start gap-3">
        <h1 className="min-w-0 flex-1 wrap-break-word font-sans text-[1.75rem] font-semibold tracking-wide text-text-primary uppercase">
          {title}
        </h1>
        {confidenceLabel ? (
          <span className="shrink-0 font-mono text-sm text-text-secondary">
            {confidenceLabel}
          </span>
        ) : null}
      </header>

      <div className="mt-4 shrink-0">
        {/* Milkdown and Shiki are browser-only; SSR shows the loading state. */}
        {mounted ? (
          <Suspense fallback={<DocumentLoading />}>
            <MilkdownView
              key={`${node.id}:${documentText}`}
              documentText={documentText}
              readOnly={true}
              scrollMode="document"
            />
          </Suspense>
        ) : (
          <DocumentLoading />
        )}
      </div>

      {impression ? (
        <section className="mt-4 shrink-0">
          <div className="text-[0.7rem] font-medium tracking-wider text-text-secondary uppercase">
            IMPRESSION
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
            {impression}
          </p>
        </section>
      ) : null}
    </>
  )
}
