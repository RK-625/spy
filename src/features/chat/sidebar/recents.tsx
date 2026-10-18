import { useMutation, usePaginatedQuery } from 'convex/react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import { ChatSidebarRecentsRow } from './recents-row'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '~/components/ui/actions/button'
import { Separator } from '~/components/ui/layout/separator'

/** Source recents layout with reactive, owner-scoped Convex pagination. */
export function ChatRecents() {
  const { chat: activeChat } = useSearch({ strict: false })
  const navigate = useNavigate()
  const remove = useMutation(api.chat.conversations.remove)
  const { results, status, loadMore } = usePaginatedQuery(
    api.chat.conversations.list,
    {},
    { initialNumItems: 30 },
  )
  function open(chat: string) {
    void navigate({ to: '/chat', search: { chat } })
  }
  async function deleteChat(id: string) {
    try {
      await remove({ conversationId: id as Id<'conversations'> })
      if (id === activeChat) void navigate({ to: '/chat', search: {} })
    } catch {
      toast.error(
        'Couldn’t delete this conversation. Stop any active response and try again.',
      )
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="font-terminal text-[0.8125rem] font-medium uppercase tracking-[0.2em] text-text-secondary">
          Recents
        </span>
        <Separator className="h-px w-auto flex-1 bg-[var(--accent-border)]" />
      </div>
      {results.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center px-3 text-sm text-text-secondary"
          role="status"
        >
          {status === 'LoadingFirstPage'
            ? 'Loading conversations…'
            : 'No conversations yet'}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2">
          {results.map((chat) => (
            <ChatSidebarRecentsRow
              key={chat._id}
              chat={{ id: chat._id, title: chat.title }}
              isActiveChat={chat._id === activeChat}
              onOpenChat={open}
              onDeleteChat={deleteChat}
            />
          ))}
          {(status === 'CanLoadMore' || status === 'LoadingMore') && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => loadMore(30)}
              disabled={status === 'LoadingMore'}
              className="mt-1 h-auto w-full justify-start rounded-[var(--radius)] px-2 py-1.5 text-left text-[0.8125rem] font-normal text-text-secondary hover:bg-surface-hover"
            >
              {status === 'LoadingMore' ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
