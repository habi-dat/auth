import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { avatarFilePath, avatarPublicUrl } from '@habidat/env/uploads'
import sharp from 'sharp'

const AVATAR_SIZE = 512
const JPEG_QUALITY = 85

/** Placeholder userId for the Discourse-visible removed avatar (URL cannot be empty). */
export const REMOVED_AVATAR_ID = 'removed'

/** Re-encode any supported image to a 512×512 JPEG for LDAP jpegPhoto. */
export async function encodeAvatarJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()
}

/** DiscourseConnect cannot clear an avatar without a fetchable URL. */
export async function ensureRemovedAvatarFile(): Promise<string> {
  const filepath = avatarFilePath(REMOVED_AVATAR_ID)
  try {
    await access(filepath)
    return avatarPublicUrl(REMOVED_AVATAR_ID)
  } catch {
    // write below
  }
  const jpeg = await sharp({
    create: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      channels: 3,
      background: { r: 229, g: 229, b: 229 },
    },
  })
    .jpeg({ quality: 50 })
    .toBuffer()
  await mkdir(path.dirname(filepath), { recursive: true })
  await writeFile(filepath, jpeg)
  return avatarPublicUrl(REMOVED_AVATAR_ID)
}
