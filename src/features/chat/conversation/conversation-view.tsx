import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Check, Copy, Globe, Lightbulb, Pencil, Split } from 'lucide-react'
import { isToolUIPart } from 'ai'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from './conversation'
import {
  Message,
  MessageAttachments,
  MessageContent,
  MessageFile,
  MessageResponse,
} from './message'
import { ChatActionButton, ChatActionRail } from './actions/action-rail'
import {
  ChainOfThought,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from './chain-of-thought'
import { Source, Sources, SourcesContent, SourcesTrigger } from './sources'
import { MessageSelectionToolbar } from './selection/selection-toolbar'
import type { MessageExcerpt } from './selection/message-selection'
import type { McpApp } from '../mcp-app/mcp-app-card'
import type { ReactNode } from 'react'
import type { ChatStatus, UIMessage } from 'ai'
import { webUrl } from '~/lib/web-url'
import { Excalidraw } from '~/components/brand/providers/excalidraw'
import { McpAppCard } from '~/features/chat/mcp-app/mcp-app-card'

type ToolPart = Extract<
  UIMessage['parts'][number],
  { type: `tool-${string}` | 'dynamic-tool' }
>

export interface ConversationViewProps {
  conversationId?: string
  messages: Array<UIMessage>
  status: ChatStatus
  error?: string | null
  onEditMessage?: (message: UIMessage) => void
  onForkMessage?: (messageId: string) => void
  forkPending?: boolean
  renderToolPart?: (part: ToolPart) => ReactNode
  onAddQuote?: (excerpt: MessageExcerpt) => void
  history?: { loading: boolean; canLoadMore: boolean; loadMore: () => void }
  /** Server-recorded Excalidraw tools whose results embed an MCP App. */
  mcpApps?: Array<McpApp>
}

function toolName(part: ToolPart) {
  return part.type === 'dynamic-tool' ? part.toolName : part.type.slice(5)
}

function findApp(apps: Array<McpApp> | undefined, name: string) {
  return apps?.find((app) => app.toolNames.includes(name))
}

function plainText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n')
    .trim()
}

function searchResults(
  output: unknown,
): Array<{ url: string; title?: string }> {
  if (
    !output ||
    typeof output !== 'object' ||
    !('results' in output) ||
    !Array.isArray(output.results)
  )
    return []
  return output.results
    .flatMap((result: unknown) => {
      if (
        !result ||
        typeof result !== 'object' ||
        !('url' in result) ||
        typeof result.url !== 'string'
      )
        return []
      const url = webUrl(result.url)
      if (!url) return []
      return [
        {
          url,
          title:
            'title' in result && typeof result.title === 'string'
              ? result.title
              : undefined,
        },
      ]
    })
    .slice(0, 6)
}

function ThoughtSteps({
  message,
  streaming,
  mcpApps,
}: {
  message: UIMessage
  streaming: boolean
  mcpApps?: Array<McpApp>
}) {
  const steps = message.parts.filter(
    (part) => part.type === 'reasoning' || isToolUIPart(part),
  )
  if (steps.length === 0) return null
  return (
    <ChainOfThought isStreaming={streaming} stepCount={steps.length}>
      {steps.map((part, index) => {
        if (part.type === 'reasoning') {
          const text = part.text.trim().replace(/\s+/g, ' ')
          return (
            <ChainOfThoughtStep
              key={`reasoning-${index}`}
              icon={Lightbulb}
              label={
                text
                  ? `${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`
                  : 'Thinking…'
              }
              status={part.state === 'streaming' ? 'active' : 'complete'}
            />
          )
        }
        const complete =
          part.state === 'output-available' ||
          part.state === 'output-error' ||
          part.state === 'output-denied'
        const name = toolName(part)
        const isApp = Boolean(findApp(mcpApps, name))
        const isSearch = name === 'webSearch'
        const isQuestion = name === 'askUserQuestion'
        const input = part.input
        const query =
          input &&
          typeof input === 'object' &&
          'query' in input &&
          typeof input.query === 'string'
            ? input.query
            : null
        const results =
          isSearch && part.state === 'output-available'
            ? searchResults(part.output)
            : []
        // Product tools report safe failures as { error } outputs.
        const toolError =
          part.state === 'output-available' &&
          part.output &&
          typeof part.output === 'object' &&
          'error' in part.output &&
          typeof part.output.error === 'string'
            ? part.output.error.slice(0, 250)
            : undefined
        return (
          <ChainOfThoughtStep
            key={part.toolCallId}
            icon={
              isSearch ? (
                Globe
              ) : isApp ? (
                <Excalidraw className="size-3 shrink-0" aria-hidden />
              ) : undefined
            }
            label={
              isSearch
                ? query || 'Searching the web'
                : isQuestion
                  ? 'Question for you'
                  : name
            }
            status={
              complete || (isQuestion && part.state === 'input-available')
                ? 'complete'
                : 'active'
            }
            description={
              part.state === 'output-error'
                ? 'The tool could not finish.'
                : part.state === 'output-denied'
                  ? 'Tool request declined.'
                  : toolError
            }
          >
            {results.length > 0 && (
              <ChainOfThoughtSearchResults>
                {results.map((result) => (
                  <ChainOfThoughtSearchResult
                    key={result.url}
                    href={result.url}
                    title={result.title}
                  />
                ))}
              </ChainOfThoughtSearchResults>
            )}
          </ChainOfThoughtStep>
        )
      })}
      {!streaming && message.parts.some((part) => part.type === 'text') && (
        <ChainOfThoughtStep
          icon={Check}
          label="Done"
          status="complete"
          isLast
        />
      )}
    </ChainOfThought>
  )
}

/** Original conversation presentation; the owning feature supplies durable state and actions. */
export function ConversationView({
  conversationId,
  messages,
  status,
  error,
  onEditMessage,
  onForkMessage,
  forkPending,
  renderToolPart,
  onAddQuote,
  history,
  mcpApps,
}: ConversationViewProps) {
  const selectionScopeId = useId()
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const copiedReset = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (copiedReset.current) clearTimeout(copiedReset.current)
    },
    [],
  )
  const copyMessage = useCallback(async (message: UIMessage) => {
    const text = plainText(message)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopyError(null)
      setCopiedMessageId(message.id)
      if (copiedReset.current) clearTimeout(copiedReset.current)
      copiedReset.current = setTimeout(() => setCopiedMessageId(null), 1500)
    } catch {
      setCopyError('Couldn’t copy the message. Try copying again.')
    }
  }, [])

  return (
    <Conversation aria-label="Conversation" aria-live="polite">
      <ConversationContent
        id={selectionScopeId}
        data-chat-selection-scope
        aria-label="Conversation messages"
        className="pb-16"
      >
        {history && (history.canLoadMore || history.loading) && (
          <button
            type="button"
            disabled={history.loading}
            onClick={history.loadMore}
            className="mx-auto rounded-[var(--radius)] px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
          >
            {history.loading ? 'Loading messages…' : 'Load earlier messages'}
          </button>
        )}
        {(error || copyError) && (
          <p
            role="alert"
            className="mb-4 rounded-[var(--radius)] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error || copyError}
          </p>
        )}
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <div
              className="font-terminal text-2xl text-lavender/40"
              aria-hidden
            >
              _
            </div>
            <p className="max-w-sm text-sm text-text-secondary">
              Ask Spy anything. Throw it a question, a mess, a half-formed idea
              — and watch the web start to weave.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const streaming =
              index === messages.length - 1 &&
              (status === 'streaming' || status === 'submitted')
            const files = message.parts.filter((part) => part.type === 'file')
            const sources = message.parts.filter(
              (part) => part.type === 'source-url' && webUrl(part.url),
            )
            return (
              <Message key={message.id} from={message.role}>
                <div className="flex w-full flex-col gap-2 group-[.is-user]:items-end">
                  <ThoughtSteps
                    message={message}
                    streaming={streaming}
                    mcpApps={mcpApps}
                  />
                  {sources.length > 0 && (
                    <Sources>
                      <SourcesTrigger count={sources.length} />
                      <SourcesContent>
                        {sources.map(
                          (source) =>
                            source.type === 'source-url' && (
                              <Source
                                key={source.sourceId}
                                href={source.url}
                                title={source.title || 'Source'}
                              />
                            ),
                        )}
                      </SourcesContent>
                    </Sources>
                  )}
                  <div className="group/bubble flex w-fit max-w-full flex-col group-[.is-user]:ml-auto group-[.is-user]:items-end">
                    <div className="flex w-fit max-w-full flex-col gap-2 group-[.is-user]:ml-auto group-[.is-user]:items-end">
                      {files.length > 0 && (
                        <MessageAttachments>
                          {files.map((part, fileIndex) => (
                            <MessageFile
                              key={`${message.id}-file-${fileIndex}`}
                              part={part}
                            />
                          ))}
                        </MessageAttachments>
                      )}
                      {message.parts.map((part, partIndex) =>
                        part.type === 'text' ? (
                          <MessageContent
                            key={partIndex}
                            data-message-text
                            data-message-id={message.id}
                            data-message-role={message.role}
                            data-message-complete={!streaming}
                          >
                            <MessageResponse isAnimating={streaming}>
                              {part.text}
                            </MessageResponse>
                          </MessageContent>
                        ) : isToolUIPart(part) &&
                          findApp(mcpApps, toolName(part)) ? (
                          <McpAppCard
                            key={part.toolCallId}
                            part={part}
                            toolName={toolName(part)}
                            app={findApp(mcpApps, toolName(part))!}
                          />
                        ) : isToolUIPart(part) && renderToolPart ? (
                          <div key={part.toolCallId}>
                            {renderToolPart(part)}
                          </div>
                        ) : null,
                      )}
                    </div>
                    {!streaming && (
                      <ChatActionRail
                        reveal={message.role === 'user' ? 'hover' : 'always'}
                      >
                        {message.role === 'user' && onEditMessage && (
                          <ChatActionButton
                            icon={Pencil}
                            label="Edit"
                            onClick={() => onEditMessage(message)}
                          />
                        )}
                        {plainText(message) && (
                          <ChatActionButton
                            icon={copiedMessageId === message.id ? Check : Copy}
                            label={
                              copiedMessageId === message.id ? 'Copied' : 'Copy'
                            }
                            onClick={() => {
                              void copyMessage(message)
                            }}
                          />
                        )}
                        {message.role === 'assistant' && onForkMessage && (
                          <ChatActionButton
                            icon={Split}
                            label="Fork chat"
                            disabled={forkPending}
                            onClick={() => onForkMessage(message.id)}
                          />
                        )}
                      </ChatActionRail>
                    )}
                  </div>
                </div>
              </Message>
            )
          })
        )}
        {status === 'submitted' && <ChainOfThought isStreaming />}
      </ConversationContent>
      <ConversationScrollButton />
      {onAddQuote && (
        <MessageSelectionToolbar
          key={conversationId ?? selectionScopeId}
          scopeId={selectionScopeId}
          onAddQuote={onAddQuote}
        />
      )}
    </Conversation>
  )
}
