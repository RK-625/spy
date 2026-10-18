import { useMemo, useState } from 'react'
import { useAction } from 'convex/react'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { experimental_MCPAppRenderer as MCPAppRenderer } from '@ai-sdk/react'
import { api } from '../../../../convex/_generated/api'
import { MCP_APP_SANDBOX_URL } from './sandbox'
import type {
  MCPAppBridgeHandlers,
  MCPAppRendererProps,
  MCPAppResource,
  MCPAppSandboxConfig,
} from '@ai-sdk/react'
import type { FunctionReturnType } from 'convex/server'
import type { UIMessage } from 'ai'
import { Excalidraw } from '~/components/brand/providers/excalidraw'
import { DEFAULT_RESOLVED_THEME } from '~/components/theme/theme-preference'
import { useThemeSwitch } from '~/components/theme/use-theme-switch'

export type McpApp = FunctionReturnType<typeof api.chat.mcpApps.apps>[number]

type ToolPart = Extract<
  UIMessage['parts'][number],
  { type: `tool-${string}` | 'dynamic-tool' }
>

const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Saved Agent results hold the model-facing content parts, while streamed
 * results keep the raw MCP result. Both become an MCP `CallToolResult`.
 */
function toolResult(output: unknown) {
  if (isRecord(output) && 'content' in output) return output
  if (Array.isArray(output))
    return {
      content: output.filter(
        (part): part is { type: 'text'; text: string } =>
          isRecord(part) &&
          part.type === 'text' &&
          typeof part.text === 'string',
      ),
    }
  return { content: [], structuredContent: output }
}

const loading = (
  <div className="px-3 py-8 text-sm text-text-secondary">Loading diagram…</div>
)

/** Source `MCPAppCard`: embeds the app for an Excalidraw tool result. */
export function McpAppCard({
  part,
  toolName,
  app,
}: {
  part: ToolPart
  toolName: string
  app: McpApp
}) {
  const stored = useQuery({
    ...convexQuery(api.chat.mcpApps.resource, { uri: app.uri }),
    retry: false,
  })
  const call = useAction(api.chat.mcpAppTools.call)
  const [height, setHeight] = useState<number | null>(null)

  const resource = useMemo<MCPAppResource | undefined>(
    () =>
      stored.data
        ? {
            uri: stored.data.uri,
            mimeType: MCP_APP_MIME_TYPE,
            html: stored.data.html,
            meta: stored.data.meta,
          }
        : undefined,
    [stored.data],
  )

  // Identity comes from the server's tool mapping, not from part metadata.
  const rendererPart = useMemo(() => {
    const base = {
      type: 'dynamic-tool' as const,
      toolName,
      toolCallId: part.toolCallId,
      toolMetadata: {
        app: { resourceUri: app.uri, mimeType: MCP_APP_MIME_TYPE },
      },
    }
    if (part.state === 'output-available')
      return {
        ...base,
        state: 'output-available' as const,
        input: part.input,
        output: toolResult(part.output),
      }
    if (part.state === 'input-streaming')
      return { ...base, state: 'input-streaming' as const, input: undefined }
    return { ...base, state: 'input-available' as const, input: part.input }
  }, [app.uri, part, toolName]) as MCPAppRendererProps['part']

  const handlers = useMemo<MCPAppBridgeHandlers>(
    () => ({
      // Deny-by-default: only tools the server marked app-visible.
      allowedTools: app.appToolNames,
      callTool: async ({ name, arguments: input }) =>
        JSON.parse(
          await call({
            name,
            arguments: input ? JSON.stringify(input) : undefined,
          }),
        ) as unknown,
      openLink: ({ url }) => {
        window.open(url, '_blank', 'noopener,noreferrer')
        return {}
      },
      onSizeChange: ({ height: next }) => {
        if (typeof next === 'number' && next > 0)
          setHeight(Math.min(next, 2000))
      },
    }),
    [app.appToolNames, call],
  )

  const sandbox = useMemo<MCPAppSandboxConfig>(
    () => ({
      url: MCP_APP_SANDBOX_URL,
      title: 'Excalidraw diagram',
      // Opaque-origin proxy: messages are matched by window, not origin.
      targetOrigin: '*',
      outerSandbox: 'allow-scripts',
      innerSandbox: 'allow-scripts allow-forms',
      allowedPermissions: ['clipboardWrite'],
      style: {
        display: 'block',
        border: 0,
        width: '100%',
        height: height ?? 0,
        transition: 'height 0.25s ease',
      },
    }),
    [height],
  )

  const { resolvedTheme } = useThemeSwitch()
  const theme = resolvedTheme ?? DEFAULT_RESOLVED_THEME
  const hostContext = useMemo(
    () => ({ theme, displayMode: 'inline' as const }),
    [theme],
  )

  return (
    <section className="my-3 w-full overflow-hidden rounded-[var(--radius)] bg-card ring-1 ring-border">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Excalidraw className="size-4 shrink-0" aria-hidden />
        <h3 className="text-sm font-medium text-lavender">{toolName}</h3>
      </header>
      {stored.isError || stored.data === null ? (
        <div className="px-3 py-8 text-sm text-text-secondary">
          This diagram view isn’t available.
        </div>
      ) : resource ? (
        <MCPAppRenderer
          part={rendererPart}
          sandbox={sandbox}
          resource={resource}
          handlers={handlers}
          hostInfo={HOST_INFO}
          hostContext={hostContext}
          fallback={loading}
        />
      ) : (
        loading
      )}
    </section>
  )
}

const HOST_INFO = { name: 'Spy', version: '0.1.0' }
