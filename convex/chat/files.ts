import { ConvexError, v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { CHAT_ATTACHMENT_MAX_FILES } from '../../shared/attachments'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

const CLEANUP_GRACE = 24 * 60 * 60 * 1000

/** Only the authenticated HTTP handler can register freshly stored bytes. */
export const register = internalMutation({
  args: {
    ownerTokenIdentifier: v.string(),
    storageId: v.id('_storage'),
    filename: v.string(),
    mediaType: v.string(),
    size: v.number(),
  },
  returns: v.id('chatUploads'),
  handler: async (ctx, args) => {
    const uploadId = await ctx.db.insert('chatUploads', args)
    await ctx.scheduler.runAfter(
      CLEANUP_GRACE,
      internal.chat.files.cleanupUpload,
      { uploadId },
    )
    return uploadId
  },
})

export async function ownedUploads(
  ctx: QueryCtx,
  owner: string,
  uploadIds: Array<Id<'chatUploads'>>,
) {
  if (
    uploadIds.length > CHAT_ATTACHMENT_MAX_FILES ||
    new Set(uploadIds).size !== uploadIds.length
  ) {
    throw new ConvexError('Attach up to five different files.')
  }
  return await Promise.all(
    uploadIds.map(async (uploadId) => {
      const upload = await ctx.db.get('chatUploads', uploadId)
      if (!upload || upload.ownerTokenIdentifier !== owner)
        throw new ConvexError('An attachment is unavailable. Add it again.')
      const url = await ctx.storage.getUrl(upload.storageId)
      if (!url)
        throw new ConvexError('An attachment is unavailable. Add it again.')
      return { ...upload, url }
    }),
  )
}

export async function referenceInConversation(
  ctx: MutationCtx,
  uploadId: Id<'chatUploads'>,
  conversationId: Id<'conversations'>,
) {
  const existing = await ctx.db
    .query('chatFileReferences')
    .withIndex('by_uploadId_and_conversationId', (q) =>
      q.eq('uploadId', uploadId).eq('conversationId', conversationId),
    )
    .unique()
  if (!existing)
    await ctx.db.insert('chatFileReferences', { uploadId, conversationId })
}

export async function releaseDraftFiles(
  ctx: MutationCtx,
  draftId: Id<'chatDrafts'>,
) {
  const references = await ctx.db
    .query('chatFileReferences')
    .withIndex('by_draftId', (q) => q.eq('draftId', draftId))
    .take(CHAT_ATTACHMENT_MAX_FILES)
  for (const ref of references) {
    await ctx.db.delete('chatFileReferences', ref._id)
    await ctx.scheduler.runAfter(
      CLEANUP_GRACE,
      internal.chat.files.cleanupUpload,
      { uploadId: ref.uploadId },
    )
  }
}

export const cleanupUpload = internalMutation({
  args: { uploadId: v.id('chatUploads') },
  returns: v.null(),
  handler: async (ctx, { uploadId }) => {
    const ref = await ctx.db
      .query('chatFileReferences')
      .withIndex('by_uploadId_and_conversationId', (q) =>
        q.eq('uploadId', uploadId),
      )
      .first()
    if (!ref) {
      const upload = await ctx.db.get('chatUploads', uploadId)
      if (upload) {
        await ctx.storage.delete(upload.storageId)
        await ctx.db.delete('chatUploads', uploadId)
      }
    }
    return null
  },
})

export const releaseConversationFiles = internalMutation({
  args: { conversationId: v.id('conversations') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const refs = await ctx.db
      .query('chatFileReferences')
      .withIndex('by_conversationId', (q) =>
        q.eq('conversationId', args.conversationId),
      )
      .take(100)
    for (const ref of refs) {
      await ctx.db.delete('chatFileReferences', ref._id)
      await ctx.scheduler.runAfter(
        CLEANUP_GRACE,
        internal.chat.files.cleanupUpload,
        { uploadId: ref.uploadId },
      )
    }
    if (refs.length === 100)
      await ctx.scheduler.runAfter(
        0,
        internal.chat.files.releaseConversationFiles,
        args,
      )
    return null
  },
})
