'use server'

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@habidat/db'
import { isCustomDiscourseAvatar, resolveDiscourseAvatarDownloadUrl } from '@habidat/discourse'
import { avatarFilePath, avatarPublicUrl } from '@habidat/env/uploads'
import { webEnv } from '@habidat/env/web'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAuditLog } from '@/lib/audit'
import { encodeAvatarJpeg } from '@/lib/avatar/encode'
import { getDiscourseClient } from '@/lib/discourse/client'
import { createSyncEvent, dispatchLdapSyncAfterCommit } from '@/lib/sync/create-sync-event'
import { adminAction } from './client'

export const maxDuration = 300

export interface ImportDiscourseAvatarsResult {
  imported: number
  skippedHasPicture: number
  skippedNoCustom: number
  failed: Array<{ username: string; reason: string }>
}

const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024

export const importDiscourseAvatarsAction = adminAction
  .schema(z.object({}))
  .action(async ({ ctx }): Promise<ImportDiscourseAvatarsResult> => {
    const discourse = getDiscourseClient()
    if (!discourse || !webEnv.DISCOURSE_URL) {
      throw new Error('Discourse is not configured')
    }

    const users = await prisma.user.findMany({
      select: { id: true, username: true, name: true, image: true },
      orderBy: { username: 'asc' },
    })

    const result: ImportDiscourseAvatarsResult = {
      imported: 0,
      skippedHasPicture: 0,
      skippedNoCustom: 0,
      failed: [],
    }

    for (const user of users) {
      if (user.image) {
        result.skippedHasPicture += 1
        continue
      }

      try {
        const info = await discourse.getUserAvatarInfo(user.username)
        if (!info || !isCustomDiscourseAvatar(info)) {
          result.skippedNoCustom += 1
          continue
        }

        const url = resolveDiscourseAvatarDownloadUrl(webEnv.DISCOURSE_URL, info.avatarTemplate)
        const raw = await discourse.downloadBinary(url)
        if (raw.length > MAX_DOWNLOAD_BYTES) {
          result.failed.push({ username: user.username, reason: 'Downloaded image too large' })
          continue
        }

        const jpeg = await encodeAvatarJpeg(raw)
        const filepath = avatarFilePath(user.id)
        await mkdir(path.dirname(filepath), { recursive: true })
        await writeFile(filepath, jpeg)
        const imageUrl = avatarPublicUrl(user.id)

        const { ldapSyncEventId } = await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: { image: imageUrl },
          })
          const ldapSyncEvent = await createSyncEvent(tx, {
            target: 'LDAP',
            operation: 'UPDATE',
            entityType: 'USER',
            entityId: user.id,
            payload: { userId: user.id },
          })
          return { ldapSyncEventId: ldapSyncEvent.id }
        })
        await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
        result.imported += 1
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Unknown error'
        result.failed.push({ username: user.username, reason })
      }
    }

    await createAuditLog({
      actorId: ctx.session.user.id,
      action: 'UPDATE',
      entityType: 'SETTING',
      entityId: 'discourse-avatars-import',
      newValue: {
        imported: result.imported,
        skippedHasPicture: result.skippedHasPicture,
        skippedNoCustom: result.skippedNoCustom,
        failedCount: result.failed.length,
      },
      entityName: 'Discourse avatars import',
    })

    revalidatePath('/profile')
    revalidatePath('/users')
    revalidatePath('/settings')
    return result
  })
