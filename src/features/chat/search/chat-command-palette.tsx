import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useNavigate } from '@tanstack/react-router'
import { MessageSquare } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type {
  CommandPaletteGroupDef,
  CommandPaletteProps,
} from '~/components/workspace/search/command-palette'
import { CommandPalette } from '~/components/workspace/search/command-palette'
import { useWorkspaceAccess } from '~/features/providers/workspace-access'

/** Data access stays in the feature; the source palette owns keyboard/focus behavior. */
export function ChatCommandPalette(props: CommandPaletteProps) {
  const { keys } = useWorkspaceAccess()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const text = query.trim()
  const enabled = Boolean(props.open && keys.ready)
  const recent = useQuery({
    ...convexQuery(api.chat.conversations.list, {
      paginationOpts: { cursor: null, numItems: 20 },
    }),
    enabled: enabled && !text,
    retry: false,
  })
  const search = useQuery({
    ...convexQuery(api.chat.conversations.search, { text }),
    enabled: enabled && Boolean(text),
    retry: false,
  })
  const rows = text ? search.data : recent.data?.page
  const loading = enabled && (text ? search.isPending : recent.isPending)
  const failed = enabled && (text ? search.isError : recent.isError)
  const groups = useMemo<Array<CommandPaletteGroupDef>>(
    () =>
      rows?.length
        ? [
            {
              heading: text ? 'Conversations' : 'Recent conversations',
              items: rows.map((chat) => ({
                label: chat.title,
                icon: MessageSquare,
                action: () => {
                  void navigate({ to: '/chat', search: { chat: chat._id } })
                },
              })),
            },
          ]
        : [],
    [navigate, rows, text],
  )
  const status = failed
    ? 'Couldn’t load conversations. Close search and try again.'
    : loading
      ? 'Searching conversations…'
      : enabled && rows?.length === 0
        ? text
          ? 'No conversations found.'
          : 'No conversations yet.'
        : null
  return (
    <CommandPalette
      {...props}
      onQueryChange={setQuery}
      remoteGroups={enabled ? groups : []}
      remoteStatus={status}
    />
  )
}
