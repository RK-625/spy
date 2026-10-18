/** Shared boundary for model-authored questions and the restored composer UI. */
export interface AskUserQuestionInput {
  question: string
  options: Array<string>
  allowCustomInput: boolean
}

export function parseAskUserQuestion(
  value: unknown,
): AskUserQuestionInput | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('question' in value) ||
    typeof value.question !== 'string' ||
    !value.question.trim() ||
    value.question.length > 10_000 ||
    !('options' in value) ||
    !Array.isArray(value.options) ||
    value.options.length < 2 ||
    value.options.length > 5 ||
    !('allowCustomInput' in value) ||
    typeof value.allowCustomInput !== 'boolean'
  )
    return null
  const options: Array<string> = []
  for (const option of value.options) {
    if (typeof option !== 'string' || !option.trim() || option.length > 1000)
      return null
    options.push(option.trim())
  }
  if (new Set(options).size !== options.length) return null
  return {
    question: value.question.trim(),
    options,
    allowCustomInput: value.allowCustomInput,
  }
}
