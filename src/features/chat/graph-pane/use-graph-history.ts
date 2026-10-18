import { useMemo } from 'react'
import { usePaginatedQuery, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { GraphHistoryMessage, GraphJobStatus } from './types'

const PAGE_SIZE = 50

/**
 * Reactive graph history and maintainer status for one conversation. Convex
 * subscriptions replace the source's graph-events stream: steps the maintainer
 * appends arrive here as it writes them.
 */
export function useGraphHistory(
  conversationId: Id<'conversations'> | undefined,
) {
  const status = useQuery(
    api.chat.graph.status,
    conversationId ? { conversationId } : 'skip',
  )
  const history = usePaginatedQuery(
    api.chat.graph.history,
    conversationId ? { conversationId } : 'skip',
    { initialNumItems: PAGE_SIZE },
  )
  const messages = useMemo(() => {
    const parsed: Array<GraphHistoryMessage> = []
    // Pages arrive newest first; the feed parser reads history oldest first.
    for (let index = history.results.length - 1; index >= 0; index--) {
      const row = history.results[index]
      try {
        const message = JSON.parse(row.json) as GraphHistoryMessage
        parsed.push({ ...message, graphSource: row.graphSource })
      } catch {
        // Rows are validated server-side; skip anything unreadable.
      }
    }
    return parsed
  }, [history.results])
  const { loadMore } = history
  const paneStatus: GraphJobStatus = status ?? 'idle'
  return useMemo(
    () => ({
      status: paneStatus,
      messages,
      canLoadMore: history.status === 'CanLoadMore',
      loadingMore: history.status === 'LoadingMore',
      loadMore: () => loadMore(PAGE_SIZE),
    }),
    [paneStatus, messages, history.status, loadMore],
  )
}
