import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import type { UIMessage } from 'ai'
import type { PromptInputMessage } from '~/features/chat/types'
import { ConversationView } from '~/features/chat/conversation/conversation-view'
import { PromptInputProvider } from '~/features/chat/prompt/shell/context'
import { PromptInputWorkspace } from '~/features/chat/prompt/shell/prompt-input'

// Presentation-only key hints enable the source picker; these are not credentials.
const providerKeys = {
  keyHints: {
    deepseek: 'demo',
    meta: 'demo',
    openai: 'demo',
    anthropic: 'demo',
    google: 'demo',
    exa: 'demo',
  },
  loadError: null,
  reload: () => {},
}

export function ComposerPreview() {
  const [messages, setMessages] = useState<Array<UIMessage>>([])
  const send = useCallback((message: PromptInputMessage) => {
    setMessages((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        role: 'user',
        parts: [{ type: 'text', text: message.text }, ...message.files],
      },
    ])
  }, [])
  return (
    <main
      aria-label="Composer presentation preview"
      className="flex h-full min-h-0 flex-col"
    >
      <p className="flex-none border-b border-border-subtle px-4 py-2 text-xs text-lavender-muted">
        Composer preview · messages stay in this page; no model or database
        calls.
      </p>
      <PromptInputProvider chatId="composer-preview">
        <ConversationView messages={messages} status="ready" />
        <PromptInputWorkspace
          status="ready"
          onSubmitMessage={send}
          stop={() => {}}
          providerKeys={providerKeys}
          openSettings={(pane) =>
            toast.info(`Open ${pane} from workspace Settings.`)
          }
        />
      </PromptInputProvider>
    </main>
  )
}
