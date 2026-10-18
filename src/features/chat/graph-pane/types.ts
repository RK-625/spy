import type { ModelMessage } from 'ai'

/** Which agent issued a graph-history message. */
export type GraphMessageSource = 'chat' | 'graph'

/** Graph-history message with its origin marker. */
export type GraphHistoryMessage = ModelMessage & {
  graphSource: GraphMessageSource
}

/** Maintainer run beside the message feed. "idle" is a finished run. */
export type GraphJobStatus = 'idle' | 'running' | 'failed'
