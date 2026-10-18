import { Suspense, lazy, useEffect, useState } from 'react'
import { PromptInputTextarea } from '../body/textarea'

const MarkdownEditor = lazy(() => import('./markdown-editor'))

/** Browser-only editor, sharing the same draft with its SSR/loading fallback. */
export function PromptEditor() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <PromptInputTextarea />
  return (
    <Suspense fallback={<PromptInputTextarea />}>
      <MarkdownEditor />
    </Suspense>
  )
}
