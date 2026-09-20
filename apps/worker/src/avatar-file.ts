import { readFile } from 'node:fs/promises'
import { avatarFilePath } from '@habidat/env/uploads'

/**
 * Read the stored JPEG for LDAP jpegPhoto.
 * `null` = user has no picture (delete attribute).
 * `undefined` = image is set but the file is missing (do not touch LDAP).
 */
export async function loadUserJpegPhoto(user: {
  id: string
  image: string | null
}): Promise<Buffer | null | undefined> {
  if (!user.image) return null
  try {
    return await readFile(avatarFilePath(user.id))
  } catch {
    return undefined
  }
}

/** Push when the file is new or bytes differ; delete only when LDAP still has a photo. */
export function jpegPhotoNeedsUpdate(
  desired: Buffer | null | undefined,
  current: Buffer | undefined
): boolean {
  if (desired === undefined) return false
  if (desired === null) return current != null
  if (current == null || current.length === 0) return true
  return !desired.equals(current)
}
