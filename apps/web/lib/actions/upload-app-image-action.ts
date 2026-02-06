'use server'

import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { requireAdmin } from '@/lib/auth/session'
import { prisma } from '@habidat/db'
import { revalidatePath } from 'next/cache'

const UPLOADS_DIR = 'public/uploads/apps'
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
}

type ImageType = 'icon' | 'logo'

interface UploadResult {
  success: true
  imageUrl: string
}

interface UploadError {
  success: false
  error: string
}

/** Upload app icon or logo. Admin only. */
export async function uploadAppImageAction(
  formData: FormData
): Promise<UploadResult | UploadError> {
  try {
    await requireAdmin()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  const appId = formData.get('appId') as string | null
  const imageType = formData.get('imageType') as ImageType | null
  const file = formData.get('file') as File | null

  if (!appId) {
    return { success: false, error: 'App ID is required' }
  }

  if (!imageType || !['icon', 'logo'].includes(imageType)) {
    return { success: false, error: 'Invalid image type' }
  }

  if (!file || file.size === 0) {
    return { success: false, error: 'No file provided' }
  }

  if (file.size > MAX_SIZE_BYTES) {
    return { success: false, error: 'File too large (max 2MB)' }
  }

  const mime = file.type?.toLowerCase()
  if (!mime || !ALLOWED_TYPES.includes(mime)) {
    return { success: false, error: 'Invalid file type (use PNG, JPEG, SVG or WebP)' }
  }

  // Verify app exists
  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) {
    return { success: false, error: 'App not found' }
  }

  const ext = EXT_BY_MIME[mime] ?? '.png'
  const filename = `${imageType}${ext}`
  const cwd = process.cwd()
  const dir = path.join(cwd, UPLOADS_DIR, appId)
  const filepath = path.join(dir, filename)

  try {
    await mkdir(dir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filepath, buffer)
  } catch (err) {
    console.error('[uploadAppImage]', err)
    return { success: false, error: 'Failed to save file' }
  }

  const imageUrl = `/uploads/apps/${appId}/${filename}`

  // Update app record
  await prisma.app.update({
    where: { id: appId },
    data: imageType === 'icon' ? { iconUrl: imageUrl } : { logoUrl: imageUrl },
  })

  revalidatePath('/apps')
  revalidatePath(`/apps/${app.slug}/edit`)
  return { success: true, imageUrl }
}

/** Remove app icon or logo. Admin only. */
export async function removeAppImageAction(
  appId: string,
  imageType: ImageType
): Promise<{ success: true } | UploadError> {
  try {
    await requireAdmin()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) {
    return { success: false, error: 'App not found' }
  }

  const currentUrl = imageType === 'icon' ? app.iconUrl : app.logoUrl
  if (currentUrl) {
    // Try to delete the file
    const cwd = process.cwd()
    const filepath = path.join(cwd, 'public', currentUrl)
    try {
      await unlink(filepath)
    } catch {
      // File might not exist, continue anyway
    }
  }

  // Update app record
  await prisma.app.update({
    where: { id: appId },
    data: imageType === 'icon' ? { iconUrl: null } : { logoUrl: null },
  })

  revalidatePath('/apps')
  revalidatePath(`/apps/${app.slug}/edit`)
  return { success: true }
}
