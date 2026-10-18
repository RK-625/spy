import { jsonSchema, tool } from 'ai'
import { parseAskUserQuestion } from '../../../shared/ask-user-question'
import type { AskUserQuestionInput } from '../../../shared/ask-user-question'

/** No execute handler: generation yields to the user, whose answer is the next normal chat turn. */
export const askUserQuestion = tool({
  description: `Ask a multiple-choice question (2–5 options) to resolve ambiguity or force a decision.
Set allowCustomInput to true only when a write-in is reasonable.
Do not use for open-ended chat.`,
  inputSchema: jsonSchema<AskUserQuestionInput>(
    {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          minLength: 1,
          maxLength: 10_000,
          description:
            'The question sent to the user. One concrete decision or ambiguity — the listed options must be complete answers to this question.',
        },
        options: {
          type: 'array',
          minItems: 2,
          maxItems: 5,
          items: { type: 'string', minLength: 1, maxLength: 1000 },
          description:
            '2–5 distinct choice labels. Each option is a complete, mutually exclusive answer path — not a vague stub.',
        },
        allowCustomInput: {
          type: 'boolean',
          description:
            'True only when a free-text write-in is a reasonable alternative to the listed options. False for forced-choice decisions.',
        },
      },
      required: ['question', 'options', 'allowCustomInput'],
      additionalProperties: false,
    },
    {
      validate(value) {
        const input = parseAskUserQuestion(value)
        return input
          ? { success: true, value: input }
          : {
              success: false,
              error: new Error(
                'Provide a question with two to five distinct answers and a custom-input setting.',
              ),
            }
      },
    },
  ),
})
