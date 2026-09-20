'use server'

import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { requireUserWithGroups } from '@habidat/auth/session'
import { prisma } from '@habidat/db'
import { avatarUrlForDiscourse } from '@habidat/discourse'
import { avatarFilePath, avatarPublicUrl } from '@habidat/env/uploads'
import { webEnv } from '@habidat/env/web'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAuditLog } from '@/lib/audit'
import { encodeAvatarJpeg } from '@/lib/avatar/encode'
import {
  createSyncEvent,
  dispatchDiscourseSyncAfterCommit,
  dispatchLdapSyncAfterCommit,
} from '@/lib/sync/create-sync-event'
import { userAction } from './client'

const MAX_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

async function enqueueAvatarSync(
  userId: string,
  opts: { avatarRemoved?: boolean; imagePath?: string | null } = {}
) {
  const avatarRemoved = opts.avatarRemoved === true
  const avatarUrl =
    !avatarRemoved && opts.imagePath
      ? avatarUrlForDiscourse(opts.imagePath, {
          appUrl: webEnv.APP_URL,
          fetchBaseUrl: webEnv.DISCOURSE_AVATAR_BASE_URL,
        })
      : undefined
  const { ldapSyncEventId, discourseSyncEventId } = await prisma.$transaction(async (tx) => {
    const ldapSyncEvent = await createSyncEvent(tx, {
      target: 'LDAP',
      operation: 'UPDATE',
      entityType: 'USER',
      entityId: userId,
      payload: { userId },
    })
    const discourseSyncEvent = await createSyncEvent(tx, {
      target: 'DISCOURSE',
      operation: 'UPDATE',
      entityType: 'USER',
      entityId: userId,
      payload: { userId, avatarRemoved, ...(avatarUrl ? { avatarUrl } : {}) },
    })
    return {
      ldapSyncEventId: ldapSyncEvent.id,
      discourseSyncEventId: discourseSyncEvent.id,
    }
  })
  await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
  await dispatchDiscourseSyncAfterCommit(discourseSyncEventId, 'DISCOURSE')
}

function revalidateAvatarPaths() {
  revalidatePath('/')
  revalidatePath('/profile')
  revalidatePath('/profile/edit')
  revalidatePath('/users')
}

export async function uploadAvatarAction(
  formData: FormData
): Promise<{ success: true; imageUrl: string } | { success: false; error: string }> {
  let session: Awaited<ReturnType<typeof requireUserWithGroups>>
  try {
    session = await requireUserWithGroups()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  const userId = session.user.id
  const file = formData.get('file')

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'No file provided' }
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { success: false, error: 'File too large (max 2MB)' }
  }
  const mime = file.type?.toLowerCase()
  if (!mime || !ALLOWED_TYPES.includes(mime)) {
    return { success: false, error: 'Invalid file type (use JPEG, PNG or WebP)' }
  }

  let jpeg: Buffer
  try {
    jpeg = await encodeAvatarJpeg(Buffer.from(await file.arrayBuffer()))
  } catch (err) {
    console.error('[uploadAvatar]', err)
    return { success: false, error: 'Invalid image' }
  }

  const filepath = avatarFilePath(userId)
  try {
    await mkdir(path.dirname(filepath), { recursive: true })
    await writeFile(filepath, jpeg)
  } catch (err) {
    console.error('[uploadAvatar] write', err)
    return { success: false, error: 'Failed to save file' }
  }

  const imageUrl = avatarPublicUrl(userId)
  const oldImage = session.user.image
  await prisma.user.update({
    where: { id: userId },
    data: { image: imageUrl },
  })
  await enqueueAvatarSync(userId, { imagePath: imageUrl })
  await createAuditLog({
    actorId: userId,
    action: 'UPDATE',
    entityType: 'USER',
    entityId: userId,
    oldValue: { image: oldImage ?? undefined },
    newValue: { image: imageUrl },
    entityName: session.user.name,
  })
  revalidateAvatarPaths()
  return { success: true, imageUrl }
}

export const removeAvatarAction = userAction.schema(z.object({})).action(async ({ ctx }) => {
  const userId = ctx.session.user.id
  const oldImage = ctx.session.user.image
  try {
    await unlink(avatarFilePath(userId))
  } catch {
    // File might not exist
  }
  await prisma.user.update({
    where: { id: userId },
    data: { image: null },
  })
  await enqueueAvatarSync(userId, { avatarRemoved: true })
  await createAuditLog({
    actorId: userId,
    action: 'UPDATE',
    entityType: 'USER',
    entityId: userId,
    oldValue: { image: oldImage ?? undefined },
    newValue: { image: undefined },
    entityName: ctx.session.user.name,
  })
  revalidateAvatarPaths()
  return { success: true }
})
