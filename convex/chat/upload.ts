import { env, httpAction } from '../_generated/server'
import { internal } from '../_generated/api'
import { requireKeyOwner } from '../providers/identity'
import {
  CHAT_ATTACHMENT_MAX_BYTES,
  attachmentMediaType,
} from '../../shared/attachments'

function cors(request: Request) {
  const origin = new URL(env.SITE_URL).origin
  return request.headers.get('origin') === origin
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'Authorization, Content-Type, X-File-Name',
        'Cache-Control': 'private, no-store',
        Vary: 'Origin',
      }
    : null
}

export const preflight = httpAction((_ctx, request) => {
  const headers = cors(request)
  return Promise.resolve(
    new Response(null, {
      status: headers ? 204 : 403,
      headers: headers ?? undefined,
    }),
  )
})

export const upload = httpAction(async (ctx, request) => {
  const headers = cors(request)
  if (!headers) return new Response('Origin not allowed', { status: 403 })
  let owner: string
  try {
    owner = await requireKeyOwner(ctx)
  } catch {
    return new Response('Please log in', { status: 401, headers })
  }
  let filename: string
  try {
    filename = decodeURIComponent(request.headers.get('x-file-name') ?? '')
  } catch {
    return new Response('Invalid filename', { status: 400, headers })
  }
  if (
    !filename ||
    filename.length > 1024 ||
    /[/\\]/.test(filename) ||
    Array.from(filename).some((character) => character.charCodeAt(0) < 32)
  )
    return new Response('Invalid filename', { status: 400, headers })
  const mediaType = attachmentMediaType(
    filename,
    request.headers.get('content-type') ?? '',
  )
  if (!mediaType)
    return new Response('File type not supported', { status: 400, headers })
  if (Number(request.headers.get('content-length')) > CHAT_ATTACHMENT_MAX_BYTES)
    return new Response('File exceeds 10 MB', { status: 413, headers })
  const reader = request.body?.getReader()
  if (!reader) return new Response('File is empty', { status: 400, headers })
  const chunks: Array<Uint8Array<ArrayBuffer>> = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > CHAT_ATTACHMENT_MAX_BYTES) {
        await reader.cancel()
        return new Response('File exceeds 10 MB', { status: 413, headers })
      }
      chunks.push(new Uint8Array(next.value))
    }
    const storageId = await ctx.storage.store(
      new Blob(chunks, { type: mediaType }),
    )
    try {
      const uploadId = await ctx.runMutation(internal.chat.files.register, {
        ownerTokenIdentifier: owner,
        storageId,
        filename,
        mediaType,
        size,
      })
      return Response.json({ uploadId }, { headers })
    } catch {
      await ctx.storage.delete(storageId)
      return new Response('Couldn’t save file', { status: 500, headers })
    }
  } catch {
    return new Response('Couldn’t upload file', { status: 500, headers })
  } finally {
    reader.releaseLock()
  }
})
