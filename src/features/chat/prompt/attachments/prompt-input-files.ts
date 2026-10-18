/**
 * Pure helpers for the prompt-input attachment pipeline.
 * No JSX, no React state — only utilities that can be unit-tested in isolation.
 *
 * The string `PROMPT_INPUT_ACCEPT` below is the single source of truth for the
 * product allowlist used by the chat prompt at /chat (and any future docs surface).
 * PromptInput defaults accept / max / multiple to these constants; optional props
 * override. Validation runs on add (filterIncomingFiles), so the <input accept>
 * attribute stays consistent with what we actually accept in code.
 *
 * ## Why a file is rejected (e.g. HTML drag-and-drop)
 * Both the file picker `accept` attribute and runtime `matchesAccept()` share this
 * allowlist. If a type is missing here, the OS picker may hide it and drag-drop
 * will fail with `code: "accept"` / "No files match the accepted types."
 *
 * ## Allowlist (accepted today)
 * | Pattern | Meaning |
 * |---------|---------|
 * | `image/*` | All image MIME types (png, jpeg, webp, gif, svg-as-image when browser reports image/*, …) |
 * | `.pdf` | PDF documents |
 * | `.txt` | Plain text |
 * | `.md` | Markdown notes |
 * | `.json` | Structured JSON |
 * | `.ts` `.tsx` `.js` `.jsx` | Common web/TS source |
 * | `.html` `.htm` | Web pages, notes exports, email HTML |
 * | `.csv` `.tsv` | Spreadsheet dumps, tables |
 * | `.py` | Python source |
 * | `.yaml` `.yml` | YAML config / frontmatter |
 * | `.css` | Stylesheets |
 * | `.xml` | Data / feeds |
 * | `.sql` | SQL queries / dumps |
 * | `.log` | Debug / log dumps |
 * | `.toml` | TOML config |
 * | `.go` | Go source |
 * | `.rs` | Rust source |
 * | `.docx` `.xlsx` `.pptx` | Office documents (binary; agent may parse them if the model/provider supports that file type — still valid for user dump-into-chat) |
 *
 * Caps (product limits): `PROMPT_INPUT_MAX_FILES` and `PROMPT_INPUT_MAX_FILE_SIZE`
 * below — edit those constants when changing limits, not at call sites.
 *
 * ## Formats explicitly excluded (intentional)
 *
 * | Format | Reason |
 * |--------|--------|
 * | `video/*` `audio/*` | Media notes — not in product scope |
 * | `.zip` `.tar` `.gz` | Archives — security / size risk |
 * | `.rtf` | Low value + awkward parsing |
 * | `.odt` | OpenDocument — low demand, binary |
 * | `.env` secrets files | **Never** add; secret leakage |
 *
 * When expanding types: edit `PROMPT_INPUT_ACCEPT` only (and this table). Keep
 * picker `accept` and `filterIncomingFiles` in lockstep via this single constant.
 * When changing caps: edit `PROMPT_INPUT_MAX_FILES` / `PROMPT_INPUT_MAX_FILE_SIZE`.
 */
import {
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MAX_FILES,
} from '../../../../../shared/attachments'
import type { FileUIPart } from 'ai'
import type { StoredDraftAttachment } from '../types'

export type AttachmentError = {
  code: 'max_files' | 'max_file_size' | 'accept'
  message: string
}

/**
 * Product allowlist: images, docs, code, structured data. Edit here, not at call sites.
 * PromptInput defaults `accept` / max / multiple to these constants (optional props override).
 *
 * Full rationale per format in the module header above.
 */
export const PROMPT_INPUT_ACCEPT = CHAT_ATTACHMENT_ACCEPT

/** Max attachments per prompt message. Edit here, not at call sites. */
export const PROMPT_INPUT_MAX_FILES = CHAT_ATTACHMENT_MAX_FILES

/** Whether multiple files can be selected. Edit here, not at call sites. */
export const PROMPT_INPUT_ALLOW_MULTIPLE = true

/** Max size per attachment in bytes (10MB). Edit here, not at call sites. */
export const PROMPT_INPUT_MAX_FILE_SIZE = CHAT_ATTACHMENT_MAX_BYTES

export function matchesAccept(file: File, accept?: string): boolean {
  if (!accept || accept.trim() === '') {
    return true
  }

  const patterns = accept
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const lowerName = file.name.toLowerCase()

  return patterns.some((pattern) => {
    // 1) type wildcard, e.g. image/*
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1) // "image/"
      return file.type.startsWith(prefix)
    }
    // 2) extension, e.g. .pdf, .ts
    if (pattern.startsWith('.')) {
      return lowerName.endsWith(pattern.toLowerCase())
    }
    // 3) exact MIME, e.g. application/pdf
    return file.type === pattern
  })
}

/**
 * Filter incoming files by accept, size, and capacity.
 * Calls onError with the same messages as the previous addLocal path.
 */
export function filterIncomingFiles(
  fileList: Array<File> | FileList,
  options: {
    accept?: string
    maxFileSize?: number
    maxFiles?: number
    currentCount: number
    onError?: (err: AttachmentError) => void
  },
): Array<File> {
  const { accept, maxFileSize, maxFiles, currentCount, onError } = options
  const incoming = [...fileList]
  const accepted = incoming.filter((f) => matchesAccept(f, accept))

  if (incoming.length && accepted.length === 0) {
    onError?.({
      code: 'accept',
      message: 'No files match the accepted types.',
    })
    return []
  }

  const withinSize = (f: File) => (maxFileSize ? f.size <= maxFileSize : true)
  const sized = accepted.filter(withinSize)

  if (accepted.length > 0 && sized.length === 0) {
    onError?.({
      code: 'max_file_size',
      message: 'All files exceed the maximum size.',
    })
    return []
  }

  const capacity =
    typeof maxFiles === 'number'
      ? Math.max(0, maxFiles - currentCount)
      : undefined
  const capped = typeof capacity === 'number' ? sized.slice(0, capacity) : sized

  if (typeof capacity === 'number' && sized.length > capacity) {
    onError?.({
      code: 'max_files',
      message: 'Too many files. Some were not added.',
    })
  }

  return capped
}

export type PromptAttachmentItem = FileUIPart & { id: string; blob?: Blob }

export function attachmentToDraft(
  item: PromptAttachmentItem,
): StoredDraftAttachment | null {
  if (!item.blob) return null
  return {
    blob: item.blob,
    filename: item.filename ?? 'file',
    id: item.id,
    mediaType: item.mediaType,
  }
}

export function draftToAttachment(
  stored: StoredDraftAttachment,
): PromptAttachmentItem {
  return {
    blob: stored.blob,
    filename: stored.filename,
    id: stored.id,
    mediaType: stored.mediaType,
    type: 'file' as const,
    url: URL.createObjectURL(stored.blob),
  }
}

export function filesToFileUIParts(
  files: Array<File>,
): Array<PromptAttachmentItem> {
  return files.map((file) => ({
    blob: file,
    filename: file.name,
    id: crypto.randomUUID(),
    mediaType: file.type,
    type: 'file' as const,
    url: URL.createObjectURL(file),
  }))
}

export function revokeFileUrls(files: Array<{ url?: string }>): void {
  for (const f of files) {
    if (f.url && f.url.startsWith('blob:')) {
      URL.revokeObjectURL(f.url)
    }
  }
}

export async function convertBlobToDataUrl(blob: Blob): Promise<string | null> {
  // FileReader uses callback-based API, wrapping in Promise is necessary
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () =>
      resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

export async function convertBlobUrlToDataUrl(
  url: string,
  blob?: Blob,
): Promise<string | null> {
  try {
    if (blob) {
      return await convertBlobToDataUrl(blob)
    }
    const response = await fetch(url)
    const fetchedBlob = await response.blob()
    return await convertBlobToDataUrl(fetchedBlob)
  } catch {
    return null
  }
}
