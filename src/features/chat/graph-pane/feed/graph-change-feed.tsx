import { Link2, Pencil, Plus, Search, Trash2, Unlink } from 'lucide-react'
import type { ModelMessage, ToolCallPart, ToolResultPart } from 'ai'
import type { GraphHistoryMessage, GraphMessageSource } from '../types'
import { ICON_GLYPH } from '~/styles/tokens/icons'
import { cn } from '~/lib/utils'

type ToolResultOutput = ToolResultPart['output']

export type GraphChangeKind =
  'created' | 'updated' | 'deleted' | 'linked' | 'unlinked' | 'read'

const GRAPH_FEED_TOOLS = [
  'upsertMemory',
  'deleteMemories',
  'manageLinks',
  'searchMemories',
  'getMemories',
] as const

type GraphFeedToolName = (typeof GRAPH_FEED_TOOLS)[number]

function isGraphFeedTool(toolName: string): toolName is GraphFeedToolName {
  return (GRAPH_FEED_TOOLS as ReadonlyArray<string>).includes(toolName)
}

export type GraphChange = {
  key: string
  kind: GraphChangeKind
  label: string
  failed: boolean
  origin: GraphMessageSource
}

type Link = { source: string; target: string; type: 'PARENT_OF' | 'RELATES_TO' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isToolCallPart(part: unknown): part is ToolCallPart {
  return (
    isRecord(part) &&
    part.type === 'tool-call' &&
    typeof part.toolCallId === 'string' &&
    typeof part.toolName === 'string'
  )
}

function isToolResultPart(part: unknown): part is ToolResultPart {
  return (
    isRecord(part) &&
    part.type === 'tool-result' &&
    typeof part.toolCallId === 'string' &&
    isRecord(part.output)
  )
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function stringList(value: unknown): Array<string> | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : null
}

function linkList(value: unknown): Array<Link> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item: unknown) =>
    isRecord(item) &&
    typeof item.source === 'string' &&
    typeof item.target === 'string' &&
    (item.type === 'PARENT_OF' || item.type === 'RELATES_TO')
      ? [{ source: item.source, target: item.target, type: item.type }]
      : [],
  )
}

function shortId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return 'unknown'
  return value.length > 8 ? `${value.slice(0, 6)}…` : value
}

function linkRelation(type: Link['type']): string {
  return type === 'PARENT_OF' ? 'as parent' : 'as related'
}

function pushLinkChanges(
  changes: Array<GraphChange>,
  callId: string,
  links: Array<Link>,
  kind: Extract<GraphChangeKind, 'linked' | 'unlinked'>,
  failed: boolean,
  origin: GraphMessageSource,
): void {
  const verb = kind === 'linked' ? 'Linked' : 'Unlinked'
  links.forEach((link, linkIndex) => {
    changes.push({
      key: `${callId}-${kind}-${linkIndex}`,
      kind,
      label: `${verb} ${shortId(link.source)} → ${shortId(link.target)} ${linkRelation(link.type)}`,
      failed,
      origin,
    })
  })
}

function jsonValue(output: ToolResultOutput | undefined): unknown {
  return output?.type === 'json' ? output.value : undefined
}

function resultOutputName(
  output: ToolResultOutput | undefined,
): string | undefined {
  const value = jsonValue(output)
  return isRecord(value) ? nonEmpty(value.name) : undefined
}

function collectResults(messages: Array<ModelMessage>) {
  const outputs = new Map<string, ToolResultOutput>()
  const failed = new Set<string>()
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue
    for (const part of message.content as Array<unknown>) {
      if (!isToolResultPart(part)) continue
      const output = part.output
      outputs.set(part.toolCallId, output)
      if (
        output.type === 'error-text' ||
        output.type === 'error-json' ||
        (output.type === 'json' &&
          isRecord(output.value) &&
          'error' in output.value)
      )
        failed.add(part.toolCallId)
    }
  }
  return { outputs, failed }
}

function pushToolCallChanges(
  changes: Array<GraphChange>,
  toolName: GraphFeedToolName,
  toolCallId: string,
  input: unknown,
  failed: boolean,
  resultOutput: ToolResultOutput | undefined,
  origin: GraphMessageSource,
): void {
  if (!isRecord(input)) return
  switch (toolName) {
    case 'upsertMemory': {
      const id = nonEmpty(input.id)
      const name = nonEmpty(input.name)
      if (id === undefined) {
        changes.push({
          key: toolCallId,
          kind: 'created',
          label: `Created memory “${name ?? 'untitled memory'}”`,
          failed,
          origin,
        })
        return
      }
      const resolved =
        name ?? (failed ? undefined : resultOutputName(resultOutput))
      changes.push({
        key: toolCallId,
        kind: 'updated',
        label:
          resolved !== undefined
            ? `Updated memory “${resolved}”`
            : `Updated memory ${shortId(id)}`,
        failed,
        origin,
      })
      return
    }
    case 'deleteMemories': {
      const ids = stringList(input.ids)
      if (!ids || ids.length === 0) return
      const outputValue = jsonValue(resultOutput)
      const missingIds = new Set(
        isRecord(outputValue) ? (stringList(outputValue.missingIds) ?? []) : [],
      )
      const deletedIds = new Set(
        isRecord(outputValue) && Array.isArray(outputValue.deleted)
          ? outputValue.deleted.flatMap((memory: unknown) =>
              isRecord(memory) && typeof memory.id === 'string'
                ? [memory.id]
                : [],
            )
          : [],
      )
      ;[...new Set(ids)].forEach((id, index) => {
        const verb = failed
          ? 'Failed to delete'
          : missingIds.has(id)
            ? 'Already absent:'
            : deletedIds.has(id)
              ? 'Deleted'
              : 'Deletion requested for'
        changes.push({
          key: `${toolCallId}-deleted-${index}`,
          kind: 'deleted',
          label: `${verb} memory ${shortId(id)}`,
          failed,
          origin,
        })
      })
      return
    }
    case 'manageLinks': {
      pushLinkChanges(
        changes,
        toolCallId,
        linkList(input.remove),
        'unlinked',
        failed,
        origin,
      )
      pushLinkChanges(
        changes,
        toolCallId,
        linkList(input.upsert),
        'linked',
        failed,
        origin,
      )
      return
    }
    case 'searchMemories': {
      const questions = stringList(input.questions)
      const first = questions?.[0]
      if (!questions || first === undefined) return
      const rest = questions.length - 1
      const query = `“${first.length > 60 ? `${first.slice(0, 60).trimEnd()}…` : first}”${rest > 0 ? ` (+${rest})` : ''}`
      changes.push({
        key: toolCallId,
        kind: 'read',
        label: `Searched ${query}`,
        failed,
        origin,
      })
      return
    }
    case 'getMemories': {
      if (!Array.isArray(input.memories)) return
      const outputValue = jsonValue(resultOutput)
      const results: Array<unknown> =
        isRecord(outputValue) && Array.isArray(outputValue.results)
          ? outputValue.results
          : []
      input.memories.forEach((memory: unknown, index) => {
        if (!isRecord(memory) || typeof memory.id !== 'string') return
        const hops =
          typeof memory.hops === 'number' && memory.hops > 0 ? memory.hops : 0
        const result = results[index]
        const lookupFailed = failed || (isRecord(result) && result.ok === false)
        const hopsLabel =
          hops > 0 ? ` (${hops} hop${hops === 1 ? '' : 's'})` : ''
        changes.push({
          key: `${toolCallId}-read-${index}`,
          kind: 'read',
          label: `${lookupFailed ? 'Failed to read' : 'Read'} ${shortId(memory.id)}${hopsLabel}`,
          failed: lookupFailed,
          origin,
        })
      })
      return
    }
    default: {
      const exhaustive: never = toolName
      return exhaustive
    }
  }
}

/**
 * Source change feed: newest-first graph tool calls (writes plus trimmed
 * reads) from both agents. Turns and reasoning stay in the conversation;
 * non-graph tools (web search, ask-user) are skipped.
 */
export function parseGraphChanges(
  messages: Array<GraphHistoryMessage>,
): Array<GraphChange> {
  const { outputs, failed } = collectResults(messages)
  const changes: Array<GraphChange> = []
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue
    for (const part of message.content as Array<unknown>) {
      if (!isToolCallPart(part) || !isGraphFeedTool(part.toolName)) continue
      pushToolCallChanges(
        changes,
        part.toolName,
        part.toolCallId,
        part.input,
        failed.has(part.toolCallId),
        outputs.get(part.toolCallId),
        message.graphSource,
      )
    }
  }
  return changes.reverse()
}

const CHANGE_ICON = {
  created: Plus,
  updated: Pencil,
  deleted: Trash2,
  linked: Link2,
  unlinked: Unlink,
  read: Search,
} as const

export function GraphChangeFeed({ changes }: { changes: Array<GraphChange> }) {
  return (
    <ul aria-label="Graph changes" className="flex flex-col gap-1 px-4 py-4">
      {changes.map((change) => {
        const Icon = CHANGE_ICON[change.kind]
        return (
          <li
            key={change.key}
            className={cn(
              'flex items-center gap-2.5 rounded-[var(--radius)] px-2 py-1.5',
              change.failed && 'opacity-60',
            )}
          >
            <Icon
              size={ICON_GLYPH.badge}
              strokeWidth={1.5}
              aria-hidden
              className="shrink-0 text-text-secondary"
            />
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm',
                change.kind === 'read'
                  ? 'text-text-secondary'
                  : 'text-text-primary',
              )}
            >
              {change.origin === 'chat' ? 'chat · ' : 'graph · '}
              {change.label}
            </span>
            {change.failed ? (
              <span className="shrink-0 text-sm text-text-secondary">
                · failed
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
