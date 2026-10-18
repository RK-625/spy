import type { Id } from '../../../../convex/_generated/dataModel'
import type { PromptAttachmentItem } from '../prompt/attachments/prompt-input-files'
import { authClient } from '~/lib/auth-client'

/** The authenticated HTTP upload accepts bytes, never a client-supplied storage ID or owner. */
export async function uploadAttachment(
  file: PromptAttachmentItem,
): Promise<Id<'chatUploads'>> {
  let blob = file.blob
  if (!blob) {
    if (!file.url.startsWith('blob:') && !file.url.startsWith('data:'))
      throw new Error('Unknown attachment')
    blob = await (await fetch(file.url)).blob()
  }
  const { data } = await authClient.convex.token()
  if (!data?.token) throw new Error('Please log in')
  const response = await fetch(
    `${import.meta.env.VITE_CONVEX_SITE_URL}/chat/upload`,
    {
      method: 'POST',
      body: blob,
      signal: AbortSignal.timeout(60_000),
      headers: {
        Authorization: `Bearer ${data.token}`,
        'Content-Type':
          file.mediaType || blob.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.filename || 'attachment.txt'),
      },
    },
  )
  if (!response.ok) throw new Error('Couldn’t upload attachment')
  const result: unknown = await response.json()
  if (
    !result ||
    typeof result !== 'object' ||
    !('uploadId' in result) ||
    typeof result.uploadId !== 'string'
  )
    throw new Error('Invalid upload response')
  return result.uploadId as Id<'chatUploads'>
}
