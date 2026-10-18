import {
  MEMORY_QUESTION_COUNT_MAX,
  MEMORY_QUESTION_COUNT_MIN,
  MEMORY_QUESTION_MAX_LENGTH,
  MEMORY_SEARCH_MAX_QUESTIONS,
} from './policy'

/** Document-size safety bounds; the source left these unbounded. */
const NAME_MAX_LENGTH = 500
const TEXT_MAX_LENGTH = 100_000
const SEARCH_QUESTION_MAX_LENGTH = 2000

export type MemoryPatch = {
  name?: string
  content?: string
  impression?: string
  confidence?: number
}

export type UpsertMemoryInput = MemoryPatch & {
  id?: string
  questions?: Array<string>
}

/**
 * Source upsertMemory rules. Omit id to create (every core field plus
 * questions); pass id to patch at least one field. Patching name or content
 * needs a full replacement question set. Returns an error message or null.
 */
export function upsertMemoryError(input: UpsertMemoryInput): string | null {
  const { name, content, impression, confidence, questions } = input
  if (name !== undefined && (!name.trim() || name.length > NAME_MAX_LENGTH))
    return `name must be 1 to ${NAME_MAX_LENGTH} characters`
  if (
    content !== undefined &&
    (!content.trim() || content.length > TEXT_MAX_LENGTH)
  )
    return `content must be 1 to ${TEXT_MAX_LENGTH} characters`
  if (impression !== undefined && impression.length > TEXT_MAX_LENGTH)
    return `impression must be at most ${TEXT_MAX_LENGTH} characters`
  if (
    confidence !== undefined &&
    !(Number.isFinite(confidence) && confidence >= 0 && confidence <= 1)
  )
    return 'confidence must be between 0 and 1'
  if (questions !== undefined) {
    if (
      questions.length < MEMORY_QUESTION_COUNT_MIN ||
      questions.length > MEMORY_QUESTION_COUNT_MAX
    )
      return `questions must contain ${MEMORY_QUESTION_COUNT_MIN} to ${MEMORY_QUESTION_COUNT_MAX} entries`
    if (
      questions.some(
        (text) => !text.trim() || text.length > MEMORY_QUESTION_MAX_LENGTH,
      )
    )
      return `each question must be 1 to ${MEMORY_QUESTION_MAX_LENGTH} characters`
  }

  if (input.id === undefined) {
    if (name === undefined) return 'name required to create a Memory'
    if (content === undefined) return 'content required to create a Memory'
    if (impression === undefined || !impression.trim())
      return 'impression required to create a Memory'
    if (confidence === undefined)
      return 'confidence required to create a Memory'
    if (questions === undefined) return 'questions required to create a Memory'
    return null
  }

  if (
    name === undefined &&
    content === undefined &&
    impression === undefined &&
    confidence === undefined &&
    questions === undefined
  )
    return 'When id is set, provide at least one of name, content, impression, confidence, or questions.'
  if ((name !== undefined || content !== undefined) && questions === undefined)
    return 'When patching name or content, questions are required (full replacement set).'
  return null
}

/** Source searchMemories input rules. Returns an error message or null. */
export function searchQuestionsError(questions: Array<string>): string | null {
  if (questions.length === 0 || questions.length > MEMORY_SEARCH_MAX_QUESTIONS)
    return `Ask 1 to ${MEMORY_SEARCH_MAX_QUESTIONS} questions.`
  if (
    questions.some(
      (text) => !text.trim() || text.length > SEARCH_QUESTION_MAX_LENGTH,
    )
  )
    return `Each question must be 1 to ${SEARCH_QUESTION_MAX_LENGTH} characters.`
  return null
}
