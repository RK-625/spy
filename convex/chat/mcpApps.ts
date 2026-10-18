/**
 * Stored MCP App UI resources (source `/api/mcp-apps` resource reads).
 * Only the reply worker writes them after reading the fixed Excalidraw server;
 * signed-in clients read them to render inside the sandboxed app frame.
 */

import { v } from 'convex/values'
import { internalMutation, internalQuery, query } from '../_generated/server'
import { requireKeyOwner } from '../providers/identity'
import { mcpAppMeta } from './validators'

/** Re-read a stored resource from the server after this long. */
export const MCP_APP_RESOURCE_TTL_MS = 6 * 60 * 60 * 1000
/** UTF-8 bytes; keeps the HTML inside Convex's 1 MiB document limit alongside its metadata. */
export const MCP_APP_RESOURCE_MAX_BYTES = 900_000
const MAX_RESOURCES = 20

const app = v.object({
  uri: v.string(),
  toolNames: v.array(v.string()),
  appToolNames: v.array(v.string()),
})

/** Which declared resources need a fresh read. */
export const staleUris = internalQuery({
  args: { uris: v.array(v.string()), now: v.number() },
  returns: v.array(v.string()),
  handler: async (ctx, { uris, now }) => {
    const stale: Array<string> = []
    for (const uri of uris.slice(0, MAX_RESOURCES)) {
      const row = await ctx.db
        .query('mcpAppResources')
        .withIndex('by_server_and_uri', (q) =>
          q.eq('server', 'excalidraw').eq('uri', uri),
        )
        .unique()
      if (!row || now - row.updatedAt > MCP_APP_RESOURCE_TTL_MS) stale.push(uri)
    }
    return stale
  },
})

/** Upserts at most one fresh resource and the current tool mapping for stored ones. */
export const sync = internalMutation({
  args: {
    apps: v.array(app),
    resource: v.optional(
      v.object({
        uri: v.string(),
        html: v.string(),
        meta: v.optional(mcpAppMeta),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    for (const entry of args.apps.slice(0, MAX_RESOURCES)) {
      const row = await ctx.db
        .query('mcpAppResources')
        .withIndex('by_server_and_uri', (q) =>
          q.eq('server', 'excalidraw').eq('uri', entry.uri),
        )
        .unique()
      const resource =
        args.resource?.uri === entry.uri ? args.resource : undefined
      if (
        resource &&
        new TextEncoder().encode(resource.html).length <=
          MCP_APP_RESOURCE_MAX_BYTES
      ) {
        const fields = {
          html: resource.html,
          meta: resource.meta,
          toolNames: entry.toolNames,
          appToolNames: entry.appToolNames,
          updatedAt: now,
        }
        if (row) await ctx.db.patch('mcpAppResources', row._id, fields)
        else
          await ctx.db.insert('mcpAppResources', {
            server: 'excalidraw',
            uri: entry.uri,
            ...fields,
          })
      } else if (row) {
        await ctx.db.patch('mcpAppResources', row._id, {
          toolNames: entry.toolNames,
          appToolNames: entry.appToolNames,
        })
      }
    }
    return null
  },
})

/** Tool-to-resource mapping used to pick which tool results embed an app. */
export const apps = query({
  args: {},
  returns: v.array(app),
  handler: async (ctx) => {
    await requireKeyOwner(ctx)
    const rows = await ctx.db
      .query('mcpAppResources')
      .withIndex('by_server_and_uri', (q) => q.eq('server', 'excalidraw'))
      .take(MAX_RESOURCES)
    return rows.map((row) => ({
      uri: row.uri,
      toolNames: row.toolNames,
      appToolNames: row.appToolNames,
    }))
  },
})

export const resource = query({
  args: { uri: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      uri: v.string(),
      html: v.string(),
      meta: v.optional(mcpAppMeta),
    }),
  ),
  handler: async (ctx, { uri }) => {
    await requireKeyOwner(ctx)
    if (!uri.startsWith('ui://')) return null
    const row = await ctx.db
      .query('mcpAppResources')
      .withIndex('by_server_and_uri', (q) =>
        q.eq('server', 'excalidraw').eq('uri', uri),
      )
      .unique()
    return row ? { uri: row.uri, html: row.html, meta: row.meta } : null
  },
})
