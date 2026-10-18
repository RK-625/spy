import { useEffect, useMemo, useRef, useState } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { toUIMessages, useThreadMessages } from '@convex-dev/agent/react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { ChatWorkspace } from './chat-workspace'
import { useSavedDraft } from './storage/use-saved-draft'
import { getPendingAskUserQuestion } from './ask-user-question'
import { GraphPane } from './graph-pane/graph-pane'
import type { Id } from '../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import type { ComposerPreferences, PromptInputMessage } from './types'
import { useWorkspaceAccess } from '~/features/providers/workspace-access'

type Conversation = NonNullable<
  FunctionReturnType<typeof api.chat.conversations.get>
>

export function ChatPage({
  conversationId,
  newDraftKey,
}: {
  conversationId?: string
  newDraftKey?: string
}) {
  const result = useQuery({
    ...convexQuery(api.chat.conversations.get, {
      conversationId: conversationId as Id<'conversations'> | undefined,
    }),
    placeholderData: keepPreviousData,
    retry: false,
  })
  if (result.isError) return <ChatUnavailable />
  if (
    result.isPending ||
    (result.isPlaceholderData &&
      conversationId &&
      result.data?._id !== conversationId &&
      !newDraftKey)
  )
    return <ChatLoading />
  const conversation = conversationId ? result.data : null
  if (
    conversation?.status === 'forking' ||
    conversation?.status === 'fork-error'
  )
    return <ForkProgress conversation={conversation} />
  const draftKey = conversation?.draftKey ?? conversation?._id ?? newDraftKey
  if (!draftKey) return <ChatLoading />
  return (
    <DraftScope
      key={draftKey}
      draftKey={draftKey}
      conversation={conversation}
    />
  )
}

function ForkProgress({ conversation }: { conversation: Conversation }) {
  const navigate = useNavigate()
  const failed = conversation.status === 'fork-error'
  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-text-secondary">
      <p role={failed ? 'alert' : 'status'}>
        {failed ? conversation.error : 'Forking conversation…'}
      </p>
      {!failed && (
        <p>
          Your copy will appear here when it’s ready. You can leave this page
          and return from Recents.
        </p>
      )}
      {conversation.sourceConversationId && (
        <button
          type="button"
          className="rounded px-3 py-2 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            void navigate({
              to: '/chat',
              search: { chat: conversation.sourceConversationId },
            })
          }}
        >
          Back to original chat
        </button>
      )}
      <button
        type="button"
        className="rounded px-3 py-2 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          void navigate({ to: '/chat', search: { draft: crypto.randomUUID() } })
        }}
      >
        New chat
      </button>
    </main>
  )
}

function ChatUnavailable() {
  const navigate = useNavigate()
  return (
    <div
      role="alert"
      className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-text-secondary"
    >
      <p>
        This conversation is unavailable. Check your connection or start a new
        chat.
      </p>
      <button
        type="button"
        className="rounded px-3 py-2 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          void navigate({ to: '/chat', search: { draft: crypto.randomUUID() } })
        }}
      >
        New chat
      </button>
    </div>
  )
}

function ChatLoading() {
  return (
    <div
      role="status"
      className="flex h-full items-center justify-center text-sm text-text-secondary"
    >
      Loading conversation…
    </div>
  )
}

function DraftScope({
  draftKey,
  conversation,
}: {
  draftKey: string
  conversation: Conversation | null
}) {
  const draft = useQuery({
    ...convexQuery(api.chat.drafts.get, { draftKey }),
    retry: false,
  })
  if (draft.isError)
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-text-secondary"
      >
        <p>Couldn’t load your saved draft.</p>
        <button
          type="button"
          className="rounded px-3 py-2 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            void draft.refetch()
          }}
        >
          Try again
        </button>
      </div>
    )
  if (draft.isPending) return <ChatLoading />
  return (
    <LiveChat
      draftKey={draftKey}
      conversation={conversation}
      savedDraft={draft.data}
    />
  )
}

function LiveChat({
  draftKey,
  conversation: serverConversation,
  savedDraft,
}: {
  draftKey: string
  conversation: Conversation | null
  savedDraft: FunctionReturnType<typeof api.chat.drafts.get>
}) {
  const { keys, openSettings } = useWorkspaceAccess()
  const navigate = useNavigate()
  const [acceptedConversation, setAcceptedConversation] =
    useState<Conversation | null>(null)
  const conversation = serverConversation ?? acceptedConversation
  const draft = useSavedDraft(draftKey, conversation?._id, savedDraft)
  const send = useMutation(api.chat.conversations.send)
  const stop = useMutation(api.chat.conversations.stop)
  const createFork = useMutation(api.chat.forks.create)
  const dismissQuestion = useMutation(api.chat.questions.dismiss)
  const forkInFlight = useRef(false)
  const [forkPending, setForkPending] = useState(false)
  const history = useThreadMessages(
    api.chat.messages.list,
    conversation ? { threadId: conversation.threadId } : 'skip',
    { initialNumItems: 30, stream: true },
  )
  const [historyLoaded, setHistoryLoaded] = useState(!conversation)
  useEffect(() => {
    if (history.status !== 'LoadingFirstPage') setHistoryLoaded(true)
  }, [history.status])
  const messages = useMemo(
    () => toUIMessages(history.results),
    [history.results],
  )
  const mcpApps = useQuery({
    ...convexQuery(api.chat.mcpApps.apps, {}),
    retry: false,
  })
  const pendingAsk = useMemo(
    () => getPendingAskUserQuestion(messages),
    [messages],
  )

  async function fork(messageId: string, preferences: ComposerPreferences) {
    if (!conversation || forkInFlight.current) return
    forkInFlight.current = true
    setForkPending(true)
    try {
      await draft.flush()
      const result = await createFork({
        conversationId: conversation._id,
        messageId,
        requestId: crypto.randomUUID(),
        preferences,
      })
      await navigate({ to: '/chat', search: { chat: result.conversationId } })
    } catch {
      toast.error(
        'Couldn’t fork this reply. Check your connection and try again.',
      )
    } finally {
      forkInFlight.current = false
      setForkPending(false)
    }
  }

  async function submit(
    message: PromptInputMessage,
    preferences: ComposerPreferences,
  ) {
    await draft.flush()
    const uploadIds = await draft.attachmentIds(message.attachmentIds ?? [])
    if (uploadIds.length !== message.files.length)
      throw new Error('Attachment preparation failed')
    const accepted = await send({
      conversationId: conversation?._id,
      requestId: crypto.randomUUID(),
      text: message.text,
      model: preferences.model,
      mode: preferences.mode,
      useWebSearch: preferences.useWebSearch,
      useBuildMode: preferences.useBuildMode,
      useExcalidraw: preferences.useExcalidraw,
      uploadIds,
      draftKey,
      draftVersion: message.draftVersion,
    })
    if (!conversation) {
      setAcceptedConversation({
        _id: accepted.conversationId,
        threadId: accepted.threadId,
        draftKey,
        title: message.text.slice(0, 100),
        updatedAt: Date.now(),
        status: 'queued',
        error: undefined,
        sourceConversationId: undefined,
      })
      // The stable draft key keeps the editor and any newer edits mounted across first send.
      setTimeout(() => {
        void navigate({
          to: '/chat',
          search: { chat: accepted.conversationId, draft: draftKey },
          replace: true,
        })
      }, 0)
    }
  }
  if (!historyLoaded && history.status === 'LoadingFirstPage')
    return <ChatLoading />
  const status =
    conversation?.status === 'queued' || conversation?.status === 'stopping'
      ? 'submitted'
      : conversation?.status === 'streaming'
        ? 'streaming'
        : 'ready'
  return (
    <main aria-label="Chat workspace" className="relative h-full min-h-0">
      <GraphPane conversationId={conversation?._id} />
      {draft.state !== 'saved' && (
        <div
          className="absolute right-16 top-2 z-10 rounded bg-surface-chat/90 px-2 py-1 text-xs text-text-secondary"
          role="status"
        >
          {draft.state === 'saving' ? (
            'Saving draft…'
          ) : (
            <button
              type="button"
              className="text-destructive underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                void draft.flush().catch(() => {})
              }}
            >
              Couldn’t save draft. Retry
            </button>
          )}
        </div>
      )}
      <ChatWorkspace
        conversationId={draftKey}
        messages={messages}
        pendingAsk={pendingAsk}
        dismissPendingAsk={async () => {
          if (conversation && pendingAsk)
            await dismissQuestion({
              conversationId: conversation._id,
              messageId: pendingAsk.messageId,
              toolCallId: pendingAsk.toolCallId,
            })
        }}
        status={status}
        initialDraft={draft.initialDraft}
        onDraftChange={draft.onDraftChange}
        error={conversation?.error}
        providerKeys={keys}
        openSettings={openSettings}
        onSubmitMessage={submit}
        onForkMessage={(messageId, preferences) => {
          void fork(messageId, preferences)
        }}
        forkPending={forkPending}
        attachmentTransport="reference"
        stop={() => {
          if (conversation)
            void stop({ conversationId: conversation._id }).catch(() =>
              toast.error('Couldn’t stop the response. Try again.'),
            )
        }}
        tools={{ webSearch: true, build: true, excalidraw: true }}
        mcpApps={mcpApps.data}
        history={{
          loading: history.status === 'LoadingMore',
          canLoadMore: history.status === 'CanLoadMore',
          loadMore: () => history.loadMore(30),
        }}
      />
    </main>
  )
}
