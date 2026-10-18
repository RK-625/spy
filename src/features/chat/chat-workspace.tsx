import { useCallback } from 'react'
import { ConversationView } from './conversation/conversation-view'
import {
  PromptInputProvider,
  usePromptInputContext,
} from './prompt/shell/context'
import { PromptInputWorkspace } from './prompt/shell/prompt-input'
import type { ConversationViewProps } from './conversation/conversation-view'
import type { MessageExcerpt } from './conversation/selection/message-selection'
import type { PromptDraft } from './prompt/types'
import type { PromptInputWorkspaceProps } from './prompt/shell/prompt-input'
import type { ComposerPreferences } from './types'

export interface ChatWorkspaceProps extends PromptInputWorkspaceProps {
  conversationId: string
  messages: ConversationViewProps['messages']
  error?: string | null
  initialDraft?: PromptDraft
  onDraftChange?: (draft: PromptDraft) => void
  onEditMessage?: ConversationViewProps['onEditMessage']
  onForkMessage?: (messageId: string, preferences: ComposerPreferences) => void
  forkPending?: boolean
  renderToolPart?: ConversationViewProps['renderToolPart']
  history?: ConversationViewProps['history']
  mcpApps?: ConversationViewProps['mcpApps']
}

/** Source chat layout. Its owner supplies durable conversation/draft state and authenticated actions. */
export function ChatWorkspace(props: ChatWorkspaceProps) {
  return (
    <div className="relative flex size-full min-w-0 flex-col overflow-hidden">
      <PromptInputProvider
        chatId={props.conversationId}
        initialDraft={props.initialDraft}
        onDraftChange={props.onDraftChange}
      >
        <ChatWorkspaceContent {...props} />
      </PromptInputProvider>
    </div>
  )
}

function ChatWorkspaceContent({
  conversationId,
  messages,
  error,
  onEditMessage,
  onForkMessage,
  forkPending,
  renderToolPart,
  history,
  mcpApps,
  ...composer
}: ChatWorkspaceProps) {
  const { quotes, focusInput, prefs } = usePromptInputContext()
  const addQuote = useCallback(
    (excerpt: MessageExcerpt) => {
      quotes.add(excerpt)
      focusInput()
    },
    [quotes, focusInput],
  )
  return (
    <>
      <ConversationView
        conversationId={conversationId}
        messages={messages}
        status={composer.status}
        error={error}
        onEditMessage={onEditMessage}
        onForkMessage={
          onForkMessage
            ? (messageId) =>
                onForkMessage(messageId, {
                  model: prefs.model,
                  mode: prefs.mode,
                  useWebSearch: prefs.useWebSearch,
                  useExcalidraw: prefs.useExcalidraw,
                  useBuildMode: prefs.useBuildMode,
                })
            : undefined
        }
        forkPending={forkPending}
        renderToolPart={renderToolPart}
        onAddQuote={addQuote}
        history={history}
        mcpApps={mcpApps}
      />
      <PromptInputWorkspace {...composer} />
    </>
  )
}
