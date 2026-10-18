import { Book, MessageSquare, Waypoints } from 'lucide-react'

export const WORKSPACE_ROUTES = [
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/notes', label: 'Notes', icon: Book },
  { path: '/graph', label: 'Graph', icon: Waypoints },
] as const

export type WorkspacePath = (typeof WORKSPACE_ROUTES)[number]['path']

export function isWorkspaceRouteActive(pathname: string, path: WorkspacePath) {
  if (path === '/chat' && pathname === '/') return true
  return pathname === path || pathname.startsWith(`${path}/`)
}
