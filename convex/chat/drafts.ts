import { ConvexError, v } from 'convex/values'
import { mutation, query } from '../_generated/server'
import { requireKeyOwner } from '../providers/identity'
import { resolveChatModel } from '../../shared/models'
import { requireConversation } from './ownership'
import { draftContent } from './validators'
import { ownedUploads, releaseDraftFiles } from './files'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

export function validateDraftKey(key: string) {
  if (!/^[\w-]{16,100}$/.test(key)) throw new ConvexError('Invalid draft.')
}

export async function findDraft(ctx: QueryCtx, owner: string, key: string) {
  validateDraftKey(key)
  return await ctx.db
    .query('chatDrafts')
    .withIndex('by_ownerTokenIdentifier_and_draftKey', (q) =>
      q.eq('ownerTokenIdentifier', owner).eq('draftKey', key),
    )
    .unique()
}

export const get = query({
  args: { draftKey: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      ...draftContent.omit('uploadIds').fields,
      version: v.string(),
      files: v.array(
        v.object({
          id: v.id('chatUploads'),
          url: v.string(),
          filename: v.string(),
          mediaType: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { draftKey }) => {
    const owner = await requireKeyOwner(ctx)
    const draft = await findDraft(ctx, owner, draftKey)
    if (!draft) return null
    if (draft.conversationId)
      await requireConversation(ctx, draft.conversationId)
    const files = await ownedUploads(ctx, owner, draft.uploadIds)
    return {
      text: draft.text,
      quotes: draft.quotes,
      preferences: draft.preferences,
      version: draft.version,
      files: files.map((file) => ({
        id: file._id,
        url: file.url,
        filename: file.filename,
        mediaType: file.mediaType,
      })),
    }
  },
})

export const save = mutation({
  args: {
    draftKey: v.string(),
    conversationId: v.optional(v.id('conversations')),
    writerId: v.string(),
    sequence: v.number(),
    version: v.string(),
    content: draftContent,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await requireKeyOwner(ctx)
    validateDraftKey(args.writerId)
    validateDraftKey(args.version)
    if (!Number.isSafeInteger(args.sequence) || args.sequence < 1)
      throw new ConvexError('Invalid draft version.')
    const previous = await findDraft(ctx, owner, args.draftKey)
    const conversationId = previous?.conversationId ?? args.conversationId
    if (
      previous?.conversationId &&
      args.conversationId &&
      previous.conversationId !== args.conversationId
    )
      throw new ConvexError('This draft belongs to another conversation.')
    if (conversationId) {
      const conversation = await requireConversation(ctx, conversationId)
      if ((conversation.draftKey ?? conversation._id) !== args.draftKey)
        throw new ConvexError('This draft belongs to another conversation.')
    }
    if (
      previous?.writerId === args.writerId &&
      previous.sequence >= args.sequence
    )
      return null
    const content = args.content
    if (
      content.text.length > 100_000 ||
      content.quotes.length > 20 ||
      content.quotes.reduce(
        (sum, quote) => sum + quote.text.length + quote.plainText.length,
        0,
      ) > 100_000
    )
      throw new ConvexError('This draft is too large to save.')
    if (!resolveChatModel(content.preferences.model, content.preferences.mode))
      throw new ConvexError('Choose a supported model and mode.')
    await ownedUploads(ctx, owner, content.uploadIds)
    const value = {
      ...content,
      ownerTokenIdentifier: owner,
      draftKey: args.draftKey,
      conversationId,
      writerId: args.writerId,
      sequence: args.sequence,
      version: args.version,
      updatedAt: Date.now(),
    }
    const draftId = previous?._id ?? (await ctx.db.insert('chatDrafts', value))
    if (previous) {
      await ctx.db.replace('chatDrafts', draftId, value)
    }
    if (
      !previous ||
      previous.uploadIds.join(',') !== content.uploadIds.join(',')
    ) {
      if (previous) await releaseDraftFiles(ctx, draftId)
      for (const uploadId of content.uploadIds)
        await ctx.db.insert('chatFileReferences', { uploadId, draftId })
    }
    return null
  },
})

/** Clear only the accepted snapshot. Edits made during upload/acceptance stay in the draft. */
export async function consumeDraft(
  ctx: MutationCtx,
  owner: string,
  key: string,
  conversationId: Id<'conversations'>,
  version?: string,
) {
  const draft = await findDraft(ctx, owner, key)
  if (!draft) return
  if (draft.conversationId && draft.conversationId !== conversationId)
    throw new ConvexError(
      'This draft was already sent to another conversation.',
    )
  await ctx.db.patch('chatDrafts', draft._id, { conversationId })
  if (draft.version === version) {
    await ctx.db.patch('chatDrafts', draft._id, {
      text: '',
      quotes: [],
      uploadIds: [],
      updatedAt: Date.now(),
    })
    await releaseDraftFiles(ctx, draft._id)
  }
}

export async function deleteDraft(
  ctx: MutationCtx,
  owner: string,
  key: string,
) {
  const draft = await findDraft(ctx, owner, key)
  if (draft) {
    await releaseDraftFiles(ctx, draft._id)
    await ctx.db.delete('chatDrafts', draft._id)
  }
}
