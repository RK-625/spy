import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import {
  buildNotesForest,
  indexNotesFamilies,
} from '../../../shared/notes/hierarchy'

/**
 * Reactive owner-scoped graph topology plus the source Notes forest. Convex
 * shares one subscription between the sidebar and the open note.
 */
export function useNotesTopology() {
  const topology = useQuery(api.memory.topology.get)
  const forest = useMemo(
    () => (topology ? buildNotesForest(topology.memories, topology.links) : []),
    [topology],
  )
  const families = useMemo(() => indexNotesFamilies(forest), [forest])
  return { topology, forest, families }
}
