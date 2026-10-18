import type { PromptAttachmentItem } from './attachments/prompt-input-files'
import type { ComposerPreferences, PromptQuote } from '../types'

/** Browser draft value; its owning feature decides how to persist it. */
export interface PromptDraft {
  text: string
  files: Array<PromptAttachmentItem>
  quotes: Array<PromptQuote>
  preferences: ComposerPreferences
}

export interface StoredDraftAttachment {
  id: string
  blob: Blob
  filename: string
  mediaType: string
}
