import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { DEFAULT_PROMPT_PREFS } from '../prompt/shell/context'
import { uploadAttachment } from './upload-attachment'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import type { PromptDraft } from '../prompt/types'
import type { PromptAttachmentItem } from '../prompt/attachments/prompt-input-files'

type SavedDraft = FunctionReturnType<typeof api.chat.drafts.get>

/** Serial, coalesced draft writes. Each file uploads once, outside Convex mutation arguments. */
export function useSavedDraft(
  draftKey: string,
  conversationId: Id<'conversations'> | undefined,
  saved: SavedDraft,
) {
  const save = useMutation(api.chat.drafts.save)
  const [writerId] = useState(() => crypto.randomUUID())
  const [initialDraft] = useState<PromptDraft>(() =>
    saved
      ? {
          text: saved.text,
          quotes: saved.quotes,
          preferences: saved.preferences,
          files: saved.files.map((file) => ({
            ...file,
            type: 'file' as const,
          })),
          version: saved.version,
        }
      : { text: '', quotes: [], files: [], preferences: DEFAULT_PROMPT_PREFS },
  )
  const uploads = useRef(
    new Map<string, Promise<Id<'chatUploads'>>>(
      saved?.files.map((file) => [file.id, Promise.resolve(file.id)]),
    ),
  )
  const scope = useRef(conversationId)
  scope.current = conversationId
  const latest = useRef<{ draft: PromptDraft; sequence: number } | null>(null)
  const sequence = useRef(0)
  const savedSequence = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const mounted = useRef(true)
  const [state, setState] = useState<'saved' | 'saving' | 'error'>('saved')

  const ensureUpload = useCallback((file: PromptAttachmentItem) => {
    let pending = uploads.current.get(file.id)
    if (!pending) {
      pending = uploadAttachment(file).catch((error: unknown) => {
        uploads.current.delete(file.id)
        throw error
      })
      uploads.current.set(file.id, pending)
      // Uploads start as files are added; the queued save/send observes any failure.
      void pending.catch(() => {})
    }
    return pending
  }, [])

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!latest.current) return chain.current
    const operation = chain.current
      .catch(() => {})
      .then(async () => {
        // A slow upload can span many edits. Coalesce queued saves to the newest
        // snapshot instead of replaying every intermediate draft after it finishes.
        const snapshot = latest.current
        if (
          !snapshot ||
          snapshot.sequence <= savedSequence.current ||
          !snapshot.draft.version
        )
          return
        const uploadIds = await Promise.all(
          snapshot.draft.files.map(ensureUpload),
        )
        await save({
          draftKey,
          conversationId: scope.current,
          writerId,
          sequence: snapshot.sequence,
          version: snapshot.draft.version,
          content: {
            text: snapshot.draft.text,
            quotes: snapshot.draft.quotes,
            preferences: snapshot.draft.preferences,
            uploadIds,
          },
        })
        savedSequence.current = snapshot.sequence
        if (mounted.current && latest.current?.sequence === snapshot.sequence)
          setState('saved')
      })
      .catch((error: unknown) => {
        if (mounted.current) setState('error')
        throw error
      })
    chain.current = operation
    // Debounced/unmount callers have no consumer; keep their rejection handled.
    void operation.catch(() => {})
    return operation
  }, [draftKey, ensureUpload, save, writerId])

  const onDraftChange = useCallback(
    (draft: PromptDraft) => {
      if (!draft.version || latest.current?.draft.version === draft.version)
        return
      latest.current = { draft, sequence: ++sequence.current }
      for (const file of draft.files) ensureUpload(file)
      setState('saving')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void flush().catch(() => {})
      }, 350)
    },
    [ensureUpload, flush],
  )

  const attachmentIds = useCallback(
    async (ids: Array<string>) =>
      await Promise.all(
        ids.map((id) => {
          const pending = uploads.current.get(id)
          if (!pending) throw new Error('Attachment not uploaded')
          return pending
        }),
      ),
    [],
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      void flush().catch(() => {})
    }
  }, [flush])

  return { initialDraft, onDraftChange, flush, attachmentIds, state }
}
