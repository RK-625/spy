/** Product file limits shared by the original composer and authenticated upload handler. */
export const CHAT_ATTACHMENT_ACCEPT =
  'image/*,.pdf,.txt,.md,.json,.ts,.tsx,.js,.jsx,.html,.htm,.csv,.tsv,.py,.yaml,.yml,.css,.xml,.sql,.log,.toml,.go,.rs,.docx,.xlsx,.pptx'
export const CHAT_ATTACHMENT_MAX_FILES = 5
export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

const documentTypes: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export function attachmentMediaType(filename: string, suppliedType: string) {
  const mediaType = suppliedType.split(';')[0].trim().toLowerCase()
  const extension = filename.toLowerCase().split('.').at(-1) ?? ''
  if (/^image\/[a-z0-9.+-]+$/.test(mediaType)) return mediaType
  if (!CHAT_ATTACHMENT_ACCEPT.split(',').includes(`.${extension}`)) return null
  return (
    documentTypes[extension] ??
    (extension === 'md' ? 'text/markdown' : 'text/plain')
  )
}
