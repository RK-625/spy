import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  filesToFileUIParts,
  revokeFileUrls,
} from '../attachments/prompt-input-files'
import { appendPromptQuote } from '../quotes/quote-state'
import type { PromptAttachmentItem } from '../attachments/prompt-input-files'
import type { PromptDraft } from '../types'
import type { ComposerPreferences, PromptQuote } from '../../types'
import type { PropsWithChildren, RefObject } from 'react'
import { models } from '~/lib/providers/registry'

export const DEFAULT_PROMPT_PREFS: ComposerPreferences = {
  model: models[0].id,
  mode: models[0].defaultMode,
  useWebSearch: true,
  useExcalidraw: false,
  useBuildMode: false,
}

export type AttachmentAddValidator = (
  files: Array<File> | FileList,
  currentCount: number,
) => Array<File>

interface AttachmentsValue {
  files: Array<PromptAttachmentItem>
  add: (files: Array<File> | FileList) => void
  remove: (id: string) => void
  clear: () => void
  openFileDialog: () => void
}

interface PromptInputContextValue {
  chatId: string
  attachments: AttachmentsValue
  textInput: {
    value: string
    setValue: (text: string) => void
    clear: () => void
  }
  quotes: {
    items: Array<PromptQuote>
    add: (quote: Omit<PromptQuote, 'id'>) => void
    remove: (id: string) => void
    clear: () => void
  }
  prefs: ComposerPreferences & {
    setModel: (model: string) => void
    setMode: (mode: string) => void
    setUseWebSearch: (value: boolean) => void
    setUseExcalidraw: (value: boolean) => void
    setUseBuildMode: (value: boolean) => void
    toggleWebSearch: () => void
    toggleExcalidraw: () => void
    toggleBuildMode: () => void
  }
  focusInput: () => void
  clearDraft: () => void
  __registerComposerFocus: (focus: (() => void) | null) => void
  __registerFileInput: (ref: RefObject<HTMLInputElement | null>) => void
  __registerAttachmentValidator: (
    validator: AttachmentAddValidator | null,
  ) => void
}

const PromptInputContext = createContext<PromptInputContextValue | null>(null)
export function usePromptInputContext() {
  const value = useContext(PromptInputContext)
  if (!value) throw new Error('PromptInput requires PromptInputProvider')
  return value
}

type ProviderProps = PropsWithChildren<{
  chatId: string
  initialDraft?: PromptDraft
  onDraftChange?: (draft: PromptDraft) => void
}>

/** Remount the draft on chat changes; persistence stays with the owning feature. */
export function PromptInputProvider(props: ProviderProps) {
  return <PromptDraftProvider key={props.chatId} {...props} />
}

function PromptDraftProvider({
  chatId,
  initialDraft,
  onDraftChange,
  children,
}: ProviderProps) {
  const [text, setText] = useState(initialDraft?.text ?? '')
  const [files, setFiles] = useState<Array<PromptAttachmentItem>>(
    initialDraft?.files ?? [],
  )
  const [quoteItems, setQuoteItems] = useState<Array<PromptQuote>>(
    initialDraft?.quotes ?? [],
  )
  const [preferences, setPreferences] = useState(
    initialDraft?.preferences ?? DEFAULT_PROMPT_PREFS,
  )
  const filesRef = useRef(files)
  const fileInput = useRef<RefObject<HTMLInputElement | null> | null>(null)
  const validator = useRef<AttachmentAddValidator | null>(null)
  const composerFocus = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    filesRef.current = files
  }, [files])
  useEffect(() => () => revokeFileUrls(filesRef.current), [])
  const onDraftChangeRef = useRef(onDraftChange)
  useLayoutEffect(() => {
    onDraftChangeRef.current = onDraftChange
  }, [onDraftChange])
  useEffect(() => {
    onDraftChangeRef.current?.({ text, files, quotes: quoteItems, preferences })
  }, [text, files, quoteItems, preferences])

  const __registerFileInput = useCallback(
    (ref: RefObject<HTMLInputElement | null>) => {
      fileInput.current = ref
    },
    [],
  )
  const __registerAttachmentValidator = useCallback(
    (value: AttachmentAddValidator | null) => {
      validator.current = value
    },
    [],
  )
  const __registerComposerFocus = useCallback((value: (() => void) | null) => {
    composerFocus.current = value
  }, [])
  const focusInput = useCallback(() => {
    if (composerFocus.current) composerFocus.current()
    else
      fileInput.current?.current?.parentElement
        ?.querySelector<HTMLTextAreaElement>('textarea[name="message"]')
        ?.focus()
  }, [])
  const clearFiles = useCallback(() => {
    revokeFileUrls(filesRef.current)
    filesRef.current = []
    setFiles([])
  }, [])
  const addFiles = useCallback((incoming: Array<File> | FileList) => {
    const previous = filesRef.current
    const accepted = validator.current
      ? validator.current(incoming, previous.length)
      : [...incoming]
    if (!accepted.length) return
    const next = [...previous, ...filesToFileUIParts(accepted)]
    filesRef.current = next
    setFiles(next)
  }, [])
  const removeFile = useCallback((id: string) => {
    const previous = filesRef.current
    revokeFileUrls(previous.filter((file) => file.id === id))
    const next = previous.filter((file) => file.id !== id)
    filesRef.current = next
    setFiles(next)
  }, [])
  const clearText = useCallback(() => setText(''), [])
  const clearQuotes = useCallback(() => setQuoteItems([]), [])
  const clearDraft = useCallback(() => {
    clearText()
    clearQuotes()
    clearFiles()
  }, [clearText, clearQuotes, clearFiles])
  const addQuote = useCallback(
    (quote: Omit<PromptQuote, 'id'>) =>
      setQuoteItems((previous) =>
        appendPromptQuote(previous, { ...quote, id: crypto.randomUUID() }),
      ),
    [],
  )
  const removeQuote = useCallback(
    (id: string) =>
      setQuoteItems((previous) => previous.filter((quote) => quote.id !== id)),
    [],
  )
  const attachments = useMemo(
    () => ({
      files,
      add: addFiles,
      remove: removeFile,
      clear: clearFiles,
      openFileDialog: () => fileInput.current?.current?.click(),
    }),
    [files, addFiles, removeFile, clearFiles],
  )
  const quotes = useMemo(
    () => ({
      items: quoteItems,
      add: addQuote,
      remove: removeQuote,
      clear: clearQuotes,
    }),
    [quoteItems, addQuote, removeQuote, clearQuotes],
  )
  const prefs = useMemo(
    () => ({
      ...preferences,
      setModel: (model: string) =>
        setPreferences((previous) => ({ ...previous, model })),
      setMode: (mode: string) =>
        setPreferences((previous) => ({ ...previous, mode })),
      setUseWebSearch: (useWebSearch: boolean) =>
        setPreferences((previous) => ({ ...previous, useWebSearch })),
      setUseExcalidraw: (useExcalidraw: boolean) =>
        setPreferences((previous) => ({ ...previous, useExcalidraw })),
      setUseBuildMode: (useBuildMode: boolean) =>
        setPreferences((previous) => ({ ...previous, useBuildMode })),
      toggleWebSearch: () =>
        setPreferences((previous) => ({
          ...previous,
          useWebSearch: !previous.useWebSearch,
        })),
      toggleExcalidraw: () =>
        setPreferences((previous) => ({
          ...previous,
          useExcalidraw: !previous.useExcalidraw,
        })),
      toggleBuildMode: () =>
        setPreferences((previous) => ({
          ...previous,
          useBuildMode: !previous.useBuildMode,
        })),
    }),
    [preferences],
  )
  const value = useMemo(
    () => ({
      chatId,
      attachments,
      quotes,
      prefs,
      textInput: { value: text, setValue: setText, clear: clearText },
      clearDraft,
      focusInput,
      __registerFileInput,
      __registerAttachmentValidator,
      __registerComposerFocus,
    }),
    [
      chatId,
      attachments,
      quotes,
      prefs,
      text,
      clearText,
      clearDraft,
      focusInput,
      __registerFileInput,
      __registerAttachmentValidator,
      __registerComposerFocus,
    ],
  )
  return (
    <PromptInputContext.Provider value={value}>
      {children}
    </PromptInputContext.Provider>
  )
}
