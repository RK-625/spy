import { createFileRoute, redirect } from '@tanstack/react-router'
import { ChatPage } from '~/features/chat/chat-page'

export const Route = createFileRoute('/_authenticated/chat')({
  head: () => ({ meta: [{ title: 'Chat · SPY' }] }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { chat?: string; draft?: string } => ({
    chat:
      typeof search.chat === 'string' && search.chat.length <= 100
        ? search.chat
        : undefined,
    draft:
      typeof search.draft === 'string' && /^[\w-]{16,100}$/.test(search.draft)
        ? search.draft
        : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (!search.chat && !search.draft)
      throw redirect({
        to: '/chat',
        search: { draft: crypto.randomUUID() },
        replace: true,
      })
  },
  component: ChatRoute,
})

function ChatRoute() {
  const { chat, draft } = Route.useSearch()
  return <ChatPage conversationId={chat} newDraftKey={draft} />
}
