import '../prompt.css'
/**
 * Prompt shell: PromptInput form primitive + PromptInputWorkspace product export.
 * PromptInput and PromptInputWorkspace require outer PromptInputProvider.
 * Draft state lives in ./context.
 */

import { toast } from 'sonner'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Check, Globe, Hammer, Plus, Settings } from 'lucide-react'
import { PromptInputTools } from '../footer/tools'
import { PromptInputButton } from '../footer/button'
import { PromptInputSubmit } from '../footer/submit'
import { SpeechInput } from '../footer/speech-input'
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '../footer/model-selector'
import { PromptInputAttachments } from '../attachments/attachment-strip'
import { PromptQuoteStrip } from '../quotes/quote-strip'
import { formatQuotedMessage } from '../quotes/quote-state'
import { PromptInputFooter } from '../footer/footer'
import { PromptEditor } from '../editor/prompt-editor'
import { PromptInputBody } from '../body/body'
import { PromptInputHeader } from '../header/header'
import {
  PROMPT_INPUT_ACCEPT,
  PROMPT_INPUT_ALLOW_MULTIPLE,
  PROMPT_INPUT_MAX_FILES,
  PROMPT_INPUT_MAX_FILE_SIZE,
  convertBlobUrlToDataUrl,
  filterIncomingFiles,
} from '../attachments/prompt-input-files'
import { formatAskUserQuestionAnswer } from '../../ask-user-question'
import { usePromptInputContext } from './context'
import type { AttachmentError } from '../attachments/prompt-input-files'
import type {
  ChangeEventHandler,
  HTMLAttributes,
  SubmitEvent,
  SubmitEventHandler,
} from 'react'
import type { ChatStatus, FileUIPart } from 'ai'
import type { ComposerPreferences, PromptInputMessage } from '../../types'
import type { PendingAskUserQuestion } from '../../ask-user-question'
import type { ProviderKeySettings } from '~/lib/providers/types'
import type { SettingsPane } from '~/components/workspace/settings/workspace-settings'
import { InputGroup } from '~/components/ui/forms/input-group'
import { Excalidraw } from '~/components/brand/providers/excalidraw'
import { chefs, models } from '~/lib/providers/registry'
import { ICON_GLYPH } from '~/styles/tokens/icons'
import { cn } from '~/lib/utils'

// The attachment module owns the shared allowlist and limits.

// ============================================================================
// Helpers
// ============================================================================

/** Attach dragover/drop listeners on a form (or other element) that forward FileList to onFiles. */
function attachFileDrop(
  target: HTMLElement,
  onFiles: (files: FileList) => void,
): () => void {
  const onDragOver = (e: Event) => {
    const de = e as DragEvent
    if (de.dataTransfer?.types.includes('Files')) {
      de.preventDefault()
    }
  }
  const onDrop = (e: Event) => {
    const de = e as DragEvent
    if (de.dataTransfer?.types.includes('Files')) {
      de.preventDefault()
    }
    if (de.dataTransfer?.files && de.dataTransfer.files.length > 0) {
      onFiles(de.dataTransfer.files)
    }
  }
  target.addEventListener('dragover', onDragOver)
  target.addEventListener('drop', onDrop)
  return () => {
    target.removeEventListener('dragover', onDragOver)
    target.removeEventListener('drop', onDrop)
  }
}

const MOTION_DOM_PROP_KEYS = [
  'onDrag',
  'onDragStart',
  'onDragEnd',
  'onAnimationStart',
  'onAnimationEnd',
  'onAnimationIteration',
] as const

// ============================================================================
// PromptInput form
// ============================================================================

export type { PromptInputMessage }

/** Thrown by the submit handler to keep the draft; an expected outcome, not a failure to log. */
class SubmitRefusedError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'SubmitRefusedError'
  }
}

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  'onSubmit' | 'onError'
> & {
  /** MIME/extension allowlist. Defaults to `PROMPT_INPUT_ACCEPT` (product SoT). */
  accept?: string
  isMultiple?: boolean
  maxFiles?: number
  /** Max bytes per file. Defaults to `PROMPT_INPUT_MAX_FILE_SIZE`. */
  maxFileSize?: number
  onError?: (err: AttachmentError) => void
  attachmentTransport?: 'data-url' | 'reference'
  /** Resolve after the turn is accepted; reject to preserve the draft. */
  onSubmit: (
    message: PromptInputMessage,
    event: SubmitEvent<HTMLFormElement>,
  ) => void | Promise<void>
}

export const PromptInput = ({
  className,
  accept = PROMPT_INPUT_ACCEPT,
  isMultiple = PROMPT_INPUT_ALLOW_MULTIPLE,
  maxFiles = PROMPT_INPUT_MAX_FILES,
  maxFileSize = PROMPT_INPUT_MAX_FILE_SIZE,
  onError,
  attachmentTransport = 'data-url',
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  // Destructure stable register callbacks so effects do not re-run on every keystroke
  // (context value identity changes when textInput changes).
  const {
    attachments,
    textInput,
    quotes,
    draftVersion,
    __registerFileInput,
    __registerAttachmentValidator,
  } = usePromptInputContext()

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const submitting = useRef(false)
  const latestDraft = useRef({
    text: textInput.value,
    files: attachments.files,
    quotes: quotes.items,
  })
  const submitHandler = useRef(onSubmit)
  useLayoutEffect(() => {
    submitHandler.current = onSubmit
  }, [onSubmit])
  useLayoutEffect(() => {
    latestDraft.current = {
      text: textInput.value,
      files: attachments.files,
      quotes: quotes.items,
    }
  }, [textInput.value, attachments.files, quotes.items])

  // Register file input so external openFileDialog() works
  useEffect(() => {
    __registerFileInput(inputRef)
  }, [__registerFileInput])

  // Register accept/size/maxFiles gate so attachments.add is always validated
  // while PromptInput is mounted (children, drop, file picker share one path).
  // Defaults resolve to PROMPT_INPUT_* SoT; props are optional overrides.
  useEffect(() => {
    __registerAttachmentValidator((files, currentCount) => {
      return filterIncomingFiles(files, {
        accept,
        maxFileSize,
        maxFiles,
        currentCount,
        onError,
      })
    })
    return () => {
      __registerAttachmentValidator(null)
    }
  }, [__registerAttachmentValidator, accept, maxFileSize, maxFiles, onError])

  // Attach drop handlers on the prompt form only (not document-wide)
  useEffect(() => {
    const form = formRef.current
    if (!form) {
      return
    }
    return attachFileDrop(form, attachments.add)
  }, [attachments.add])

  const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      if (event.currentTarget.files) {
        attachments.add(event.currentTarget.files)
      }
      // Reset input value to allow selecting files that were previously removed
      event.currentTarget.value = ''
    },
    [attachments],
  )

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      event.preventDefault()

      if (submitting.current) return
      submitting.current = true
      const text = textInput.value
      const files = attachments.files

      try {
        // Convert blob URLs to data URLs asynchronously and shape into pure FileUIParts
        const convertedFiles: Array<FileUIPart> =
          files.length > 0
            ? await Promise.all(
                files.map(async (item) => {
                  let finalUrl = item.url
                  if (
                    attachmentTransport === 'data-url' &&
                    item.url.startsWith('blob:')
                  ) {
                    const dataUrl = await convertBlobUrlToDataUrl(
                      item.url,
                      item.blob,
                    )
                    if (!dataUrl)
                      throw new Error('Could not prepare attachment.')
                    finalUrl = dataUrl
                  }
                  return {
                    filename: item.filename,
                    mediaType: item.mediaType,
                    type: 'file' as const,
                    url: finalUrl,
                  }
                }),
              )
            : []

        await submitHandler.current(
          {
            files: convertedFiles,
            text,
            quotes: quotes.items,
            draftVersion,
            attachmentIds: files.map((file) => file.id),
          },
          event,
        )
        const latest = latestDraft.current
        // A slow upload must not erase text or files edited while it was pending.
        if (
          latest.text === text &&
          latest.files === files &&
          latest.quotes === quotes.items
        ) {
          attachments.clear()
          textInput.clear()
          quotes.clear()
        }
      } catch (error) {
        if (!(error instanceof SubmitRefusedError))
          toast.error('Couldn’t send the message. Your draft is kept.')
      } finally {
        submitting.current = false
      }
    },
    [
      attachments,
      textInput,
      quotes,
      onSubmit,
      attachmentTransport,
      draftVersion,
    ],
  )

  // Strip motion-incompatible DOM drag/animation handlers from rest spread
  const restProps = { ...props }
  for (const key of MOTION_DOM_PROP_KEYS) {
    delete restProps[key]
  }

  return (
    <>
      <input
        accept={accept}
        aria-label="Upload files"
        className="hidden"
        multiple={isMultiple}
        onChange={handleChange}
        ref={inputRef}
        title="Upload files"
        type="file"
      />
      <form
        className={cn('w-full', className)}
        onSubmit={handleSubmit}
        ref={formRef}
        {...restProps}
      >
        <InputGroup className="h-auto flex-col overflow-hidden">
          {children}
        </InputGroup>
      </form>
    </>
  )
}

// ============================================================================
// PromptInputWorkspace — product export for /chat
// ============================================================================

const ModelItem = ({
  modelEntry,
  isSelected,
  onSelect,
}: {
  modelEntry: (typeof models)[0]
  isSelected: boolean
  onSelect: (id: string) => void
}) => {
  const handleSelect = useCallback(() => {
    onSelect(modelEntry.id)
  }, [onSelect, modelEntry.id])

  return (
    <ModelSelectorItem onSelect={handleSelect} value={modelEntry.name}>
      <ModelSelectorLogo icon={modelEntry.icon} />
      <ModelSelectorName>{modelEntry.name}</ModelSelectorName>
      {isSelected ? (
        <Check size={ICON_GLYPH.badge} strokeWidth={1.5} className="ml-auto" />
      ) : (
        <div className="ml-auto size-4" />
      )}
    </ModelSelectorItem>
  )
}

export interface PromptInputWorkspaceProps {
  status: ChatStatus
  onSubmitMessage: (
    message: PromptInputMessage,
    preferences: ComposerPreferences,
  ) => void | Promise<void>
  stop: () => void
  pendingAsk?: PendingAskUserQuestion | null
  dismissPendingAsk?: () => Promise<void>
  providerKeys: Pick<ProviderKeySettings, 'keyHints' | 'loadError' | 'reload'>
  openSettings: (pane: SettingsPane) => void
  tools?: { webSearch?: boolean; build?: boolean; excalidraw?: boolean }
  attachmentTransport?: 'data-url' | 'reference'
}

/** Original composer UI. State, persistence and turn acceptance belong to its owner. */
export function PromptInputWorkspace(props: PromptInputWorkspaceProps) {
  return <PromptInputWorkspaceContent {...props} />
}

function PromptInputWorkspaceContent({
  status,
  onSubmitMessage,
  stop,
  pendingAsk = null,
  dismissPendingAsk,
  providerKeys,
  openSettings,
  tools = { webSearch: true, build: true, excalidraw: true },
  attachmentTransport,
}: PromptInputWorkspaceProps) {
  const {
    attachments,
    textInput,
    clearDraft: clearPromptDraft,
    quotes,
    prefs: {
      model,
      setModel,
      mode,
      setMode,
      useWebSearch,
      toggleWebSearch,
      useExcalidraw,
      toggleExcalidraw,
      useBuildMode,
      toggleBuildMode,
    },
  } = usePromptInputContext()

  const submitUserMessage = useCallback(
    async (message: PromptInputMessage, preferences: ComposerPreferences) => {
      await onSubmitMessage(
        { ...message, text: formatQuotedMessage(message.text, message.quotes) },
        preferences,
      )
    },
    [onSubmitMessage],
  )

  const accepting = useRef(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false)

  // Only models whose provider has a verified key are offered.
  const { keyHints, loadError, reload: reloadProviderKeys } = providerKeys
  const availableModels = useMemo(
    () => (keyHints ? models.filter((entry) => keyHints[entry.chefSlug]) : []),
    [keyHints],
  )
  // The default model is only a placeholder: it counts as selected once its
  // provider has a key. While keys load, show it rather than flash empty.
  const selectedModelData = useMemo(
    () =>
      keyHints === null
        ? models.find((entry) => entry.id === model)
        : availableModels.find((entry) => entry.id === model),
    [availableModels, keyHints, model],
  )
  const availableChefs = useMemo(
    () =>
      chefs.filter((chef) =>
        availableModels.some((entry) => entry.chef === chef),
      ),
    [availableModels],
  )
  const hasNoAvailableModels = keyHints !== null && availableModels.length === 0

  // A key removed elsewhere can strand the selection on an unusable model.
  useEffect(() => {
    if (availableModels.length === 0) return
    if (availableModels.some((entry) => entry.id === model)) return
    const [fallback] = availableModels
    setModel(fallback.id)
    setMode(fallback.defaultMode)
  }, [availableModels, model, setModel, setMode])

  const handleOpenProviderSettings = useCallback(() => {
    setModelSelectorOpen(false)
    openSettings('providers')
  }, [openSettings])

  // Web search runs only with a verified Exa key; the saved toggle is kept as-is
  // so it resumes once a key is added. The server re-checks the key per request.
  const hasExaKey = Boolean(keyHints?.exa)
  const isExaKeyMissing = keyHints !== null && !hasExaKey
  const isWebSearchActive = Boolean(
    tools.webSearch && useWebSearch && hasExaKey,
  )

  const handleWebSearchClick = useCallback(() => {
    if (isExaKeyMissing) {
      openSettings('tools')
      return
    }
    toggleWebSearch()
  }, [isExaKeyMissing, openSettings, toggleWebSearch])

  /**
   * Single accept path for form submit and MCQ option clicks.
   * Owns all validation + pending-ask shaping; then calls submitUserMessage.
   * Option select: handleSubmit({ text: option.label, files: [] }).
   *
   * Resolves once the feature accepts the turn, preserving the draft on refusal.
   */
  const handleSubmit = useCallback(
    async (message: PromptInputMessage): Promise<void> => {
      if (accepting.current)
        throw new SubmitRefusedError('Message acceptance is pending.')
      accepting.current = true
      setIsAccepting(true)
      try {
        if (status !== 'ready' && status !== 'error') {
          throw new SubmitRefusedError('Chat is not ready to send.')
        }
        if (keyHints === null) {
          // The status load failed: say so and retry, so a saved key isn't blocked
          // silently. Otherwise it is still loading: refuse quietly; the draft stays.
          if (loadError) {
            toast.error(`${loadError} Retrying — send again in a moment.`)
            reloadProviderKeys()
          }
          throw new SubmitRefusedError('Provider keys are not loaded.')
        }
        // No model with a saved key: send the user to add one; the draft stays.
        if (!selectedModelData) {
          toast.error('Add an API key to send messages')
          openSettings('providers')
          throw new SubmitRefusedError('No model with a saved API key.')
        }

        const answer = message.text.trim()
        const hasFiles = message.files.length > 0
        const prefs = {
          model,
          mode,
          useWebSearch: isWebSearchActive,
          useExcalidraw: Boolean(tools.excalidraw && useExcalidraw),
          useBuildMode: Boolean(tools.build && useBuildMode),
        }

        if (pendingAsk != null) {
          // Empty form / nothing to answer.
          if (!answer && !hasFiles) {
            throw new SubmitRefusedError('Empty message.')
          }
          // Pure MCQ: require a choice label; files alone are not an answer.
          if (!pendingAsk.allowCustomInput && !answer) {
            throw new SubmitRefusedError('Choice required.')
          }

          await submitUserMessage(
            {
              text: formatAskUserQuestionAnswer({
                question: pendingAsk.question,
                answer: answer.length > 0 ? answer : '(attachment)',
              }),
              files: message.files,
              quotes: message.quotes,
              draftVersion: message.draftVersion,
              attachmentIds: message.attachmentIds,
            },
            prefs,
          )
          return
        }

        if (!answer && !hasFiles) {
          throw new SubmitRefusedError('Empty message.')
        }

        await submitUserMessage(
          {
            text: answer,
            files: message.files,
            quotes: message.quotes,
            draftVersion: message.draftVersion,
            attachmentIds: message.attachmentIds,
          },
          prefs,
        )
      } finally {
        accepting.current = false
        setIsAccepting(false)
      }
    },
    [
      submitUserMessage,
      pendingAsk,
      status,
      keyHints,
      loadError,
      reloadProviderKeys,
      selectedModelData,
      openSettings,
      model,
      mode,
      isWebSearchActive,
      useExcalidraw,
      useBuildMode,
      tools,
    ],
  )

  const handleTranscriptionChange = useCallback(
    (transcript: string) => {
      textInput.setValue(
        textInput.value ? `${textInput.value} ${transcript}` : transcript,
      )
    },
    [textInput],
  )

  const handleAttachmentError = useCallback((err: { message: string }) => {
    toast.error(err.message)
  }, [])

  const handleSpeechError = useCallback((message: string) => {
    toast.error(message)
  }, [])

  const handleModelSelect = useCallback(
    (modelId: string) => {
      const entry = models.find((m) => m.id === modelId)
      setModel(modelId)
      if (entry) setMode(entry.defaultMode)
      setModelSelectorOpen(false)
    },
    [setModel, setMode],
  )

  const isSubmitDisabled = useMemo(
    () =>
      (isAccepting && status !== 'submitted' && status !== 'streaming') ||
      ((status === 'ready' || status === 'error') &&
        ((pendingAsk != null && !pendingAsk.allowCustomInput) ||
          (!textInput.value.trim() && attachments.files.length === 0))),
    [
      textInput.value,
      attachments.files.length,
      status,
      pendingAsk,
      isAccepting,
    ],
  )

  return (
    <div className="w-full px-4 pb-4 pt-1">
      <div className="chat-input-wrap relative">
        <div className="chat-input-glow" />
        <PromptInput
          onSubmit={handleSubmit}
          onError={handleAttachmentError}
          attachmentTransport={attachmentTransport}
        >
          <PromptInputHeader>
            <PromptQuoteStrip />
            <PromptInputAttachments />
          </PromptInputHeader>
          <PromptInputBody
            pendingAsk={pendingAsk}
            askDismissDisabled={
              isAccepting || (status !== 'ready' && status !== 'error')
            }
            onAskDismiss={
              dismissPendingAsk
                ? () => {
                    void dismissPendingAsk().catch(() =>
                      toast.error(
                        'Couldn’t dismiss question. Please try again.',
                      ),
                    )
                  }
                : undefined
            }
            onOptionSelect={(option) => {
              void handleSubmit({
                text: option.label,
                files: [],
                quotes: quotes.items,
              })
                .then(() => clearPromptDraft())
                .catch((error: unknown) => {
                  if (!(error instanceof SubmitRefusedError))
                    toast.error('Couldn’t send the answer. Please try again.')
                })
            }}
          >
            <PromptEditor />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputButton
                onClick={attachments.openFileDialog}
                size="icon-sm"
                variant="ghost"
                aria-label="Add photos or files"
                tooltip={{
                  content: 'Add photos or files',
                  side: 'top',
                }}
                className="text-text-primary hover:bg-[var(--surface-hover)]"
              >
                <Plus size={ICON_GLYPH.inline} strokeWidth={1.5} />
              </PromptInputButton>
              <SpeechInput
                className="shrink-0 text-text-primary hover:bg-[var(--surface-hover)]"
                onTranscriptionChange={handleTranscriptionChange}
                onError={handleSpeechError}
                size="icon-sm"
                variant="ghost"
              />
              {tools.webSearch && (
                <PromptInputButton
                  onClick={handleWebSearchClick}
                  size="icon-sm"
                  variant={isWebSearchActive ? 'default' : 'ghost'}
                  aria-label={
                    isExaKeyMissing
                      ? 'Add an Exa key in Settings'
                      : isWebSearchActive
                        ? 'Disable web search'
                        : 'Enable web search'
                  }
                  tooltip={{
                    content: isExaKeyMissing
                      ? 'Add an Exa key in Settings'
                      : isWebSearchActive
                        ? 'Disable web search'
                        : 'Enable web search',
                    side: 'top',
                  }}
                  className={cn(
                    'transition-colors',
                    isExaKeyMissing
                      ? 'text-text-dim hover:bg-[var(--surface-hover)]'
                      : isWebSearchActive
                        ? 'bg-primary text-accent-ink hover:bg-primary-hover'
                        : 'text-text-primary hover:bg-[var(--surface-hover)]',
                  )}
                >
                  <Globe size={ICON_GLYPH.inline} strokeWidth={1.5} />
                </PromptInputButton>
              )}
              {tools.build && (
                <PromptInputButton
                  onClick={toggleBuildMode}
                  size="icon-sm"
                  variant={useBuildMode ? 'default' : 'ghost'}
                  aria-label={
                    useBuildMode ? 'Disable build mode' : 'Enable build mode'
                  }
                  tooltip={{
                    content: useBuildMode
                      ? 'Disable build mode · return to discussing your memories'
                      : 'Enable build mode · create, update, delete, and link memories',
                    side: 'top',
                  }}
                  className={cn(
                    'transition-colors',
                    useBuildMode
                      ? 'bg-primary text-accent-ink hover:bg-primary-hover'
                      : 'text-text-primary hover:bg-[var(--surface-hover)]',
                  )}
                >
                  <Hammer size={ICON_GLYPH.inline} strokeWidth={1.5} />
                </PromptInputButton>
              )}
              {tools.excalidraw && (
                <PromptInputButton
                  onClick={toggleExcalidraw}
                  size="icon-sm"
                  variant={useExcalidraw ? 'default' : 'ghost'}
                  aria-label={
                    useExcalidraw ? 'Disable Excalidraw' : 'Enable Excalidraw'
                  }
                  tooltip={{
                    content: useExcalidraw
                      ? 'Disable Excalidraw'
                      : 'Enable Excalidraw',
                    side: 'top',
                  }}
                  className={cn(
                    'transition-colors',
                    useExcalidraw
                      ? 'bg-primary text-accent-ink hover:bg-primary-hover'
                      : 'text-text-primary hover:bg-[var(--surface-hover)]',
                  )}
                >
                  <Excalidraw className="size-4 shrink-0" />
                </PromptInputButton>
              )}
              <ModelSelector
                onOpenChange={setModelSelectorOpen}
                open={modelSelectorOpen}
              >
                <ModelSelectorTrigger asChild>
                  <PromptInputButton
                    data-model-trigger
                    size="sm"
                    className="shrink-0 px-1.5 text-text-primary hover:bg-[var(--surface-hover)] flex items-center gap-1"
                    variant="ghost"
                    aria-label={`Select model, currently ${selectedModelData?.name ?? 'none'}`}
                  >
                    {selectedModelData ? (
                      <selectedModelData.icon className="size-4 shrink-0" />
                    ) : (
                      <Settings size={ICON_GLYPH.toolbar} strokeWidth={1.5} />
                    )}
                    <span className="text-sm font-[family-name:var(--font-body)] font-medium tracking-wide">
                      {selectedModelData
                        ? selectedModelData.name
                        : 'Select model'}
                    </span>
                  </PromptInputButton>
                </ModelSelectorTrigger>
                <ModelSelectorContent>
                  {hasNoAvailableModels ? (
                    <button
                      className="flex w-full flex-col gap-0.5 px-3 py-3 text-left text-sm transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-hover)]"
                      onClick={handleOpenProviderSettings}
                      type="button"
                    >
                      <span className="text-text-primary">
                        Add an API key in Settings
                      </span>
                      <span className="text-xs text-text-secondary">
                        Models appear once a provider key is verified.
                      </span>
                    </button>
                  ) : (
                    <ModelSelectorInput placeholder="Search models..." />
                  )}
                  <ModelSelectorList>
                    {!hasNoAvailableModels && (
                      <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                    )}
                    {availableChefs.map((chef) => (
                      <ModelSelectorGroup heading={chef} key={chef}>
                        {availableModels
                          .filter((entry) => entry.chef === chef)
                          .map((entry) => (
                            <ModelItem
                              isSelected={model === entry.id}
                              key={entry.id}
                              modelEntry={entry}
                              onSelect={handleModelSelect}
                            />
                          ))}
                      </ModelSelectorGroup>
                    ))}
                  </ModelSelectorList>
                </ModelSelectorContent>
              </ModelSelector>
              {selectedModelData?.mode && selectedModelData.mode.length > 0 && (
                <ModelSelector
                  onOpenChange={setModeSelectorOpen}
                  open={modeSelectorOpen}
                >
                  <ModelSelectorTrigger asChild>
                    <PromptInputButton
                      data-model-trigger
                      size="sm"
                      className="shrink-0 px-1.5 text-text-primary hover:bg-[var(--surface-hover)] flex items-center justify-center"
                      variant="ghost"
                      aria-label="Select mode"
                    >
                      <span className="text-sm font-[family-name:var(--font-body)] font-medium tracking-wide capitalize">
                        {mode}
                      </span>
                    </PromptInputButton>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent className="w-auto">
                    <ModelSelectorList>
                      <ModelSelectorGroup>
                        {selectedModelData.mode.map((m) => (
                          <ModelSelectorItem
                            key={m}
                            value={m}
                            onSelect={(val) => {
                              setMode(val)
                              setModeSelectorOpen(false)
                            }}
                          >
                            <span className="capitalize">{m}</span>
                            {mode === m && (
                              <Check
                                size={ICON_GLYPH.badge}
                                strokeWidth={1.5}
                                className="ml-auto opacity-50"
                              />
                            )}
                          </ModelSelectorItem>
                        ))}
                      </ModelSelectorGroup>
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
              )}
            </PromptInputTools>
            <PromptInputSubmit
              className={cn(
                '!size-8 !rounded-[var(--radius)] transition-colors duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] disabled:!opacity-100',
                !isSubmitDisabled
                  ? 'bg-primary text-accent-ink hover:bg-primary-hover'
                  : 'text-text-primary hover:bg-[var(--surface-hover)]',
              )}
              variant={!isSubmitDisabled ? 'default' : 'ghost'}
              disabled={isSubmitDisabled}
              onStop={stop}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
