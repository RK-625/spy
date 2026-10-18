/**
 * Graph-history serialization shared by the maintainer mutations and its Node
 * action. Rows hold one AI SDK ModelMessage as bounded, JSON-safe text: bytes,
 * non-URL attachments and tool error bodies never reach storage or clients.
 */

/** Per-row cap, well under Convex's 1 MiB value limit even for multi-byte text. */
export const GRAPH_MESSAGE_MAX_CHARS = 48_000
/** Model context window: newest rows, bounded by count and total size. */
export const GRAPH_HISTORY_MAX_MESSAGES = 200
export const GRAPH_HISTORY_MAX_CHARS = 2_000_000
/** Source graph-agent step budget. */
export const GRAPH_AGENT_MAX_STEPS = 15

const PART_MAX_CHARS = 8_000
const TOOL_FAILED = 'Tool failed.'

type Json = null | boolean | number | string | Array<Json> | JsonObject
type JsonObject = { [key: string]: Json }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Deep JSON-safe copy. Bytes, functions and other non-JSON values are dropped. */
function plain(value: unknown, depth = 0): Json | undefined {
  if (depth > 32) return null
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof URL) return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value))
    return undefined
  if (Array.isArray(value))
    return value.map((item) => plain(item, depth + 1) ?? null)
  if (isObject(value)) {
    const out: JsonObject = {}
    for (const [key, item] of Object.entries(value)) {
      const copy = plain(item, depth + 1)
      if (copy !== undefined) out[key] = copy
    }
    return out
  }
  return undefined
}

function webUrl(value: Json | undefined) {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function clip(text: string) {
  return text.length > PART_MAX_CHARS
    ? `${text.slice(0, PART_MAX_CHARS)} [truncated]`
    : text
}

/** Safe part, or null to drop it. */
function safePart(part: Json): Json | null {
  if (!isObject(part)) return typeof part === 'string' ? part : null
  switch (part.type) {
    case 'image':
      return webUrl(part.image)
        ? part
        : { type: 'text', text: '[Image omitted]' }
    case 'file':
      return webUrl(part.data) ? part : { type: 'text', text: '[File omitted]' }
    case 'tool-result': {
      const output = part.output
      if (
        isObject(output) &&
        (output.type === 'error-text' || output.type === 'error-json')
      )
        return { ...part, output: { type: 'error-text', value: TOOL_FAILED } }
      return part
    }
    default:
      return part
  }
}

/** Second pass for oversized rows: clip long text and tool output, drop reasoning. */
function shrinkPart(part: Json): Json | null {
  if (!isObject(part)) return typeof part === 'string' ? clip(part) : null
  switch (part.type) {
    case 'text':
      return typeof part.text === 'string'
        ? { ...part, text: clip(part.text) }
        : part
    // Signed provider reasoning cannot be clipped; it is dropped instead.
    case 'reasoning':
    case 'reasoning-file':
      return null
    case 'tool-result': {
      const text = JSON.stringify(part.output ?? null)
      return text.length > PART_MAX_CHARS
        ? { ...part, output: { type: 'text', value: clip(text) } }
        : part
    }
    default:
      return part
  }
}

/** Last resort: keep the call/result pairing so later runs stay valid. */
function placeholderPart(part: Json): Json | null {
  if (!isObject(part)) return null
  if (part.type === 'tool-call') return { ...part, input: {} }
  if (part.type === 'tool-result')
    return {
      ...part,
      output: { type: 'text', value: '[Output omitted: too large]' },
    }
  return { type: 'text', text: '[Content omitted: too large]' }
}

function withContent(
  message: JsonObject,
  map: (part: Json) => Json | null,
): JsonObject {
  const content = message.content
  if (typeof content === 'string')
    return { ...message, content: map(content) ?? '' }
  if (!Array.isArray(content)) return message
  return {
    ...message,
    content: content.map(map).filter((part) => part !== null),
  }
}

/**
 * Serialize one ModelMessage for storage. The origin marker is stored beside
 * the row, not inside it. Returns null for messages that cannot be stored.
 */
export function serializeGraphMessage(message: unknown): string | null {
  const copy = plain(message)
  if (!isObject(copy)) return null
  const role = copy.role
  if (role !== 'user' && role !== 'assistant' && role !== 'tool') return null
  const base: JsonObject = { role, content: copy.content ?? [] }
  if ('providerOptions' in copy) base.providerOptions = copy.providerOptions
  let safe = withContent(base, safePart)
  let json = JSON.stringify(safe)
  if (json.length <= GRAPH_MESSAGE_MAX_CHARS) return json
  safe = withContent(safe, shrinkPart)
  json = JSON.stringify(safe)
  if (json.length <= GRAPH_MESSAGE_MAX_CHARS) return json
  json = JSON.stringify(withContent(safe, placeholderPart))
  return json.length <= GRAPH_MESSAGE_MAX_CHARS ? json : null
}

/** Re-validate a stored or caller-built row before writing it. */
export function boundedGraphJson(json: string): string | null {
  if (json.length > GRAPH_MESSAGE_MAX_CHARS) return null
  try {
    return serializeGraphMessage(JSON.parse(json))
  } catch {
    return null
  }
}
