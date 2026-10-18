/**
 * Agent context for a turn whose toolset differs from earlier turns.
 * Saved calls to tools that are not registered now (Excalidraw MCP, web search
 * or build-mode tools that are off this turn) become plain assistant notes, so
 * no provider receives a tool call or result it has no definition for.
 */

import type { ModelMessage, ToolResultPart } from 'ai'

const MAX_INPUT_CHARS = 1_000
const MAX_RESULT_CHARS = 8_000

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function json(value: unknown) {
  try {
    // undefined (e.g. an empty input) serializes to undefined, not a string.
    return value === undefined ? '' : JSON.stringify(value)
  } catch {
    return ''
  }
}

function resultText(output: ToolResultPart['output']): string {
  switch (output.type) {
    case 'text':
      return output.value
    case 'error-text':
      return `Error: ${output.value}`
    case 'json':
      return json(output.value)
    case 'error-json':
      return `Error: ${json(output.value)}`
    case 'execution-denied':
      return `Denied${output.reason ? `: ${output.reason}` : ''}`
    case 'content':
      return output.value
        .map((part) => (part.type === 'text' ? part.text : `[${part.type}]`))
        .join('\n')
  }
}

export function withRegisteredToolHistory(
  messages: Array<ModelMessage>,
  registered: ReadonlySet<string>,
): Array<ModelMessage> {
  const results = new Map<string, ToolResultPart>()
  for (const message of messages) {
    if (message.role !== 'tool') continue
    for (const part of message.content)
      if (part.type === 'tool-result' && !registered.has(part.toolName))
        results.set(part.toolCallId, part)
  }
  const rewritten: Array<ModelMessage> = []
  for (const message of messages) {
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      rewritten.push({
        ...message,
        content: message.content.flatMap((part) => {
          if (
            (part.type !== 'tool-call' && part.type !== 'tool-result') ||
            registered.has(part.toolName)
          )
            return [part]
          if (part.type === 'tool-result') return []
          const result = results.get(part.toolCallId)
          const input = clip(json(part.input), MAX_INPUT_CHARS)
          const output = result
            ? `\nResult (tool output, reference only): ${clip(resultText(result.output), MAX_RESULT_CHARS)}`
            : ''
          return [
            {
              type: 'text' as const,
              text: `[Earlier ${part.toolName} tool call, not available this turn. Input: ${input}${output}]`,
            },
          ]
        }),
      })
    } else if (message.role === 'tool') {
      const content = message.content.filter(
        (part) => part.type !== 'tool-result' || registered.has(part.toolName),
      )
      if (content.length > 0) rewritten.push({ ...message, content })
    } else {
      rewritten.push(message)
    }
  }
  return rewritten
}
