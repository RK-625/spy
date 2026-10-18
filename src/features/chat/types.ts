import type { FileUIPart } from 'ai'

export interface PromptQuote {
  id: string
  sourceMessageId: string
  sourceRole: 'user' | 'assistant'
  text: string
  plainText: string
}

export type StoredPromptQuote = Omit<PromptQuote, 'plainText'> & {
  plainText?: string
}

export interface PromptInputMessage {
  text: string
  files: Array<FileUIPart>
  quotes?: Array<PromptQuote>
}

export interface ComposerPreferences {
  model: string
  mode: string
  useWebSearch: boolean
  useExcalidraw: boolean
  useBuildMode: boolean
}
