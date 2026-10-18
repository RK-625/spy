import { useState } from 'react'
import type { UIMessage } from 'ai'
import { ConversationView } from '~/features/chat/conversation/conversation-view'
import { Button } from '~/components/ui/actions/button'

// Development-only presentation data; never reads or writes app accounts/keys.
const messages: Array<UIMessage> = [
  {
    id: 'preview-user',
    role: 'user',
    parts: [
      { type: 'text', text: 'Show how a note becomes searchable memory.' },
    ],
  },
  {
    id: 'preview-assistant',
    role: 'assistant',
    parts: [
      {
        type: 'reasoning',
        state: 'done',
        text: 'Connect the note, its embedding, and the retrieval step.',
      },
      {
        type: 'source-url',
        sourceId: 'preview-source',
        url: 'https://docs.convex.dev/',
        title: 'Convex documentation',
      },
      {
        type: 'text',
        text: '## Searchable memory\n\nAn **embedding** represents a note as a vector. A query can find related notes by comparing their vectors.\n\n| Step | Result |\n| --- | --- |\n| Save a note | Durable text |\n| Embed it | Searchable vector |\n| Retrieve | Relevant context |\n\n```ts\nconst note = { title: "An idea", text: "Connect the dots." };\n```\n\nFor vectors $u$ and $v$, cosine similarity is $\\frac{u \\cdot v}{\\lVert u \\rVert \\lVert v \\rVert}$.\n\n```mermaid\ngraph LR\n  Note --> Embedding\n  Embedding --> Retrieval\n```\n\n> Keep the original note available alongside retrieved context.\n\n- Save the source\n- Link related ideas',
      },
    ],
  },
]

export function ConversationPreview() {
  const [empty, setEmpty] = useState(false)
  const [streaming, setStreaming] = useState(false)
  return (
    <main
      aria-label="Conversation presentation preview"
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex flex-none gap-2 border-b border-border-subtle p-3">
        <Button variant="ghost" size="sm" onClick={() => setEmpty(!empty)}>
          {empty ? 'Show messages' : 'Show empty state'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStreaming(!streaming)}
        >
          {streaming ? 'Complete' : 'Show streaming state'}
        </Button>
      </div>
      <ConversationView
        messages={empty ? [] : messages}
        status={streaming ? 'streaming' : 'ready'}
      />
    </main>
  )
}
