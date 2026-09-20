import { existsSync } from 'node:fs'
import path from 'node:path'

export const AVATAR_DIR_NAME = 'avatars'

/** Public URL stored on User.image */
export function avatarPublicUrl(userId: string): string {
  return `/uploads/${AVATAR_DIR_NAME}/${userId}.jpg`
}

/**
 * Directory that contains `avatars/` and app logos.
 * Resolves the shared docker volume, Next standalone, or local monorepo paths.
 */
export function getUploadsRoot(): string {
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR

  const candidates = [
    path.join(process.cwd(), 'public', 'uploads'),
    path.join(process.cwd(), 'apps', 'web', 'public', 'uploads'),
    path.join(process.cwd(), '..', 'web', 'public', 'uploads'),
    '/app/apps/web/public/uploads',
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }

  if (existsSync(path.join(process.cwd(), 'apps', 'web', 'public'))) {
    return path.join(process.cwd(), 'apps', 'web', 'public', 'uploads')
  }
  if (existsSync(path.join(process.cwd(), 'public'))) {
    return path.join(process.cwd(), 'public', 'uploads')
  }
  return path.join(process.cwd(), 'apps', 'web', 'public', 'uploads')
}

export function avatarFilePath(userId: string): string {
  return path.join(getUploadsRoot(), AVATAR_DIR_NAME, `${userId}.jpg`)
}
