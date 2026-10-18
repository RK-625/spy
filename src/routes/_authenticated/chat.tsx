import { createFileRoute } from '@tanstack/react-router'
import { ChatPage } from '~/features/chat/chat-page'

export const Route = createFileRoute('/_authenticated/chat')({
  head: () => ({ meta: [{ title: 'Chat · SPY' }] }),
  validateSearch: (search: Record<string, unknown>): { chat?: string } => ({
    chat:
      typeof search.chat === 'string' && search.chat.length <= 100
        ? search.chat
        : undefined,
  }),
  component: ChatRoute,
})

function ChatRoute() {
  const { chat } = Route.useSearch()
  return <ChatPage conversationId={chat} />
}
