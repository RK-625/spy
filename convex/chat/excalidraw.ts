'use node'

/**
 * Remote Excalidraw MCP connector (source `src/ai/tools/excalidraw-mcp.ts`).
 * One short-lived client per reply or app tool call; callers always close it.
 * Requests carry no user credentials, keys or Convex auth.
 */

import {
  createMCPClient,
  mcpAppClientCapabilities,
  readMCPAppResource,
  splitMCPAppTools,
} from '@ai-sdk/mcp'
import type { ListToolsResult, MCPAppResource, MCPClient } from '@ai-sdk/mcp'
import type { Infer } from 'convex/values'
import type { ToolSet } from 'ai'
import type { mcpAppMeta } from './validators'

export const EXCALIDRAW_MCP_URL = 'https://mcp.excalidraw.com/mcp'

const CONNECT_TIMEOUT_MS = 15_000
const REQUEST_TIMEOUT_MS = 30_000
const MAX_TOOLS = 20
const MAX_DOMAINS = 30
/** Names the model and the app frame may use; an untrusted server cannot add others. */
const TOOL_NAME = /^[A-Za-z0-9_-]{1,64}$/

export type McpAppEntry = {
  uri: string
  toolNames: Array<string>
  appToolNames: Array<string>
}

type McpAppMeta = Infer<typeof mcpAppMeta>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onLate: (value: T) => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const state = { timedOut: false }
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          state.timedOut = true
          reject(new Error('Excalidraw MCP timed out'))
        }, ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
    // A client that connects after the deadline is closed rather than leaked.
    if (state.timedOut) void promise.then(onLate, () => {})
  }
}

async function openClient(): Promise<MCPClient> {
  return withTimeout(
    createMCPClient({
      transport: { type: 'http', url: EXCALIDRAW_MCP_URL, redirect: 'error' },
      clientName: 'spy-mcp-apps-host',
      capabilities: mcpAppClientCapabilities,
    }),
    CONNECT_TIMEOUT_MS,
    (client) => void client.close().catch(() => {}),
  )
}

function names(definitions: ListToolsResult) {
  return definitions.tools
    .map((tool) => tool.name)
    .filter((name) => TOOL_NAME.test(name))
    .slice(0, MAX_TOOLS)
}

function resourceUri(tool: ListToolsResult['tools'][number]) {
  const ui = tool._meta?.ui
  const uri =
    isRecord(ui) && typeof ui.resourceUri === 'string'
      ? ui.resourceUri
      : tool._meta?.['ui/resourceUri']
  return typeof uri === 'string' && uri.startsWith('ui://') && uri.length < 500
    ? uri
    : undefined
}

/** Groups model-visible tools by the `ui://` resource that renders their results. */
function appEntries(
  modelVisible: ListToolsResult,
  appVisible: ListToolsResult,
): Array<McpAppEntry> {
  const appToolNames = names(appVisible)
  const allowed = new Set(names(modelVisible))
  const byUri = new Map<string, Array<string>>()
  for (const tool of [...modelVisible.tools, ...appVisible.tools]) {
    const uri = resourceUri(tool)
    if (!uri) continue
    const toolNames = byUri.get(uri) ?? []
    if (allowed.has(tool.name) && !toolNames.includes(tool.name))
      toolNames.push(tool.name)
    byUri.set(uri, toolNames)
  }
  return [...byUri]
    .slice(0, MAX_TOOLS)
    .map(([uri, toolNames]) => ({ uri, toolNames, appToolNames }))
}

function domains(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === 'string' && item.length < 300,
        )
        .slice(0, MAX_DOMAINS)
    : undefined
}

/** Keeps only the fields the sandbox understands, as Convex-safe values. */
function sanitizeMeta(meta: MCPAppResource['meta']): McpAppMeta | undefined {
  if (!meta) return undefined
  const csp = isRecord(meta.csp)
    ? {
        connectDomains: domains(meta.csp.connectDomains),
        resourceDomains: domains(meta.csp.resourceDomains),
        frameDomains: domains(meta.csp.frameDomains),
      }
    : undefined
  const requested = isRecord(meta.permissions) ? meta.permissions : undefined
  return {
    prefersBorder:
      typeof meta.prefersBorder === 'boolean' ? meta.prefersBorder : undefined,
    csp,
    permissions: requested
      ? {
          camera: Boolean(requested.camera),
          microphone: Boolean(requested.microphone),
          geolocation: Boolean(requested.geolocation),
          clipboardWrite: Boolean(requested.clipboardWrite),
        }
      : undefined,
  }
}

export type ExcalidrawConnection = {
  tools: ToolSet
  apps: Array<McpAppEntry>
  readResource: (
    uri: string,
  ) => Promise<{ uri: string; html: string; meta?: McpAppMeta } | null>
  close: () => Promise<void>
}

/** Connects for one reply. The caller must call `close` in `finally`. */
export async function connectExcalidraw(
  signal: AbortSignal,
): Promise<ExcalidrawConnection> {
  const client = await openClient()
  try {
    const definitions = await client.listTools({
      options: { signal, timeout: REQUEST_TIMEOUT_MS },
    })
    const { modelVisible, appVisible } = splitMCPAppTools(definitions)
    const allowed = new Set(names(modelVisible))
    const visible = {
      ...modelVisible,
      tools: modelVisible.tools.filter((tool) => allowed.has(tool.name)),
    }
    return {
      tools: client.toolsFromDefinitions(visible) as ToolSet,
      apps: appEntries(modelVisible, appVisible),
      readResource: async (uri) => {
        try {
          const resource = await readMCPAppResource({
            client,
            uri,
            options: { signal, timeout: REQUEST_TIMEOUT_MS },
          })
          return {
            uri,
            html: resource.html,
            meta: sanitizeMeta(resource.meta),
          }
        } catch {
          return null
        }
      },
      close: () => client.close(),
    }
  } catch (error) {
    await client.close().catch(() => {})
    throw error
  }
}

export class AppToolDeniedError extends Error {}

/** Proxies one app-visible tool call. Model-only tools are refused. */
export async function callExcalidrawAppTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const client = await openClient()
  try {
    const options = { timeout: REQUEST_TIMEOUT_MS }
    const { appVisible } = splitMCPAppTools(await client.listTools({ options }))
    if (!names(appVisible).includes(name)) throw new AppToolDeniedError()
    return await client.callTool({ name, arguments: args, options })
  } finally {
    await client.close().catch(() => {})
  }
}
