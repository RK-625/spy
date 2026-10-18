import type { UIMessage } from 'ai'

export interface PendingAskUserQuestion {
  toolCallId: string
  messageId: string
  question: string
  options: Array<{ id: string; label: string }>
  allowCustomInput: boolean
}

export function formatAskUserQuestionAnswer({
  question,
  answer,
}: {
  question: string
  answer: string
}) {
  return `Q: ${question.trim()}\nA: ${answer.trim()}`
}

/** Presentation-only derivation; tool resolution is supplied by the chat feature. */
export function getPendingAskUserQuestion(
  messages: Array<UIMessage>,
): PendingAskUserQuestion | null {
  const last = messages.at(-1)
  if (!last || last.role !== 'assistant') return null
  for (const part of [...last.parts].reverse()) {
    if (
      part.type !== 'tool-askUserQuestion' ||
      part.state !== 'input-available'
    )
      continue
    const input: unknown = part.input
    if (
      !input ||
      typeof input !== 'object' ||
      !('question' in input) ||
      typeof input.question !== 'string' ||
      !input.question.trim() ||
      !('options' in input) ||
      !Array.isArray(input.options) ||
      !('allowCustomInput' in input) ||
      typeof input.allowCustomInput !== 'boolean'
    )
      continue
    const options = input.options.flatMap((label: unknown, index) =>
      typeof label === 'string' && label.trim()
        ? [{ id: `opt-${index}`, label: label.trim() }]
        : [],
    )
    if (options.length < 2 || options.length > 5) continue
    return {
      messageId: last.id,
      toolCallId: part.toolCallId,
      question: input.question.trim(),
      options,
      allowCustomInput: input.allowCustomInput,
    }
  }
  return null
}
