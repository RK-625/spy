import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import type { UIMessage } from 'ai'
import type { PromptInputMessage } from '~/features/chat/types'
import { ChatWorkspace } from '~/features/chat/chat-workspace'

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
      <ChatWorkspace
        conversationId="composer-preview"
        messages={messages}
        status="ready"
        onSubmitMessage={send}
        stop={() => {}}
        providerKeys={providerKeys}
        openSettings={(pane) =>
          toast.info(`Open ${pane} from workspace Settings.`)
        }
      />
    </main>
  )
}
