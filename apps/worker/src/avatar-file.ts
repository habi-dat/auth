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

/**
 * ldapjs-client returns jpegPhoto as a UTF-8 string, so byte equality is
 * unreliable. Always push when we have a file; delete only when LDAP still
 * has a photo.
 */
export function jpegPhotoNeedsUpdate(
  desired: Buffer | null | undefined,
  current: Buffer | undefined
): boolean {
  if (desired === undefined) return false
  if (desired === null) return current != null
  return true
}
