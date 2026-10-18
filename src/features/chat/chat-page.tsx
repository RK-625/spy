import { useMemo } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { toUIMessages, useThreadMessages } from '@convex-dev/agent/react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { ChatWorkspace } from './chat-workspace'
import type { Id } from '../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import type { ComposerPreferences, PromptInputMessage } from './types'
import { useWorkspaceAccess } from '~/features/providers/workspace-access'

export function ChatPage({ conversationId }: { conversationId?: string }) {
  return conversationId ? (
    <SavedChat
      key={conversationId}
      conversationId={conversationId as Id<'conversations'>}
    />
  ) : (
    <LiveChat key="new" conversation={null} />
  )
}

function SavedChat({
  conversationId,
}: {
  conversationId: Id<'conversations'>
}) {
  const result = useQuery({
    ...convexQuery(api.chat.conversations.get, { conversationId }),
    retry: false,
  })
  const navigate = useNavigate()
  if (result.isError)
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
            void navigate({ to: '/chat', search: {} })
          }}
        >
          New chat
        </button>
      </div>
    )
  if (!result.data) return <ChatLoading />
  return <LiveChat conversation={result.data} />
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

function LiveChat({
  conversation,
}: {
  conversation: FunctionReturnType<typeof api.chat.conversations.get> | null
}) {
  const { keys, openSettings } = useWorkspaceAccess()
  const navigate = useNavigate()
  const send = useMutation(api.chat.conversations.send)
  const stop = useMutation(api.chat.conversations.stop)
  const history = useThreadMessages(
    api.chat.messages.list,
    conversation ? { threadId: conversation.threadId } : 'skip',
    { initialNumItems: 30, stream: true },
  )
  const messages = useMemo(
    () => toUIMessages(history.results),
    [history.results],
  )
  async function submit(
    message: PromptInputMessage,
    preferences: ComposerPreferences,
  ) {
    if (message.files.length) {
      toast.error(
        'File transport is still being connected. Your draft is kept.',
      )
      throw new Error('Attachments are not connected yet')
    }
    const accepted = await send({
      conversationId: conversation?._id,
      requestId: crypto.randomUUID(),
      text: message.text,
      model: preferences.model,
      mode: preferences.mode,
    })
    if (!conversation) {
      // Let the form clear its accepted snapshot before changing its conversation scope.
      setTimeout(() => {
        void navigate({
          to: '/chat',
          search: { chat: accepted.conversationId },
        })
      }, 0)
    }
  }
  if (conversation && history.status === 'LoadingFirstPage')
    return <ChatLoading />
  const status =
    conversation?.status === 'queued' || conversation?.status === 'stopping'
      ? 'submitted'
      : conversation?.status === 'streaming'
        ? 'streaming'
        : 'ready'
  return (
    <main aria-label="Chat workspace" className="h-full min-h-0">
      <ChatWorkspace
        conversationId={conversation?._id ?? 'new'}
        messages={messages}
        status={status}
        error={conversation?.error}
        providerKeys={keys}
        openSettings={openSettings}
        onSubmitMessage={submit}
        stop={() => {
          if (conversation)
            void stop({ conversationId: conversation._id }).catch(() =>
              toast.error('Couldn’t stop the response. Try again.'),
            )
        }}
        tools={{ webSearch: false, build: false, excalidraw: false }}
        history={{
          loading: history.status === 'LoadingMore',
          canLoadMore: history.status === 'CanLoadMore',
          loadMore: () => history.loadMore(30),
        }}
      />
    </main>
  )
}
