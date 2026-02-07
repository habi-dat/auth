'use server'

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { requireAdmin } from '@habidat/auth/session'
import { updateGeneralSettings } from '@/lib/settings/general'
import { revalidatePath } from 'next/cache'

const UPLOADS_DIR = 'public/uploads'
const LOGO_BASENAME = 'logo'
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
}

/** Upload logo file and update general settings. Admin only. Returns new logoUrl or error. */
export async function uploadLogoAction(
  formData: FormData
): Promise<{ success: true; logoUrl: string } | { success: false; error: string }> {
  try {
    await requireAdmin()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  const file = formData.get('logo') as File | null
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

  const ext = EXT_BY_MIME[mime] ?? '.png'
  const filename = `${LOGO_BASENAME}${ext}`
  const cwd = process.cwd()
  const dir = path.join(cwd, UPLOADS_DIR)
  const filepath = path.join(dir, filename)

  try {
    await mkdir(dir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filepath, buffer)
  } catch (err) {
    console.error('[uploadLogo]', err)
    return { success: false, error: 'Failed to save file' }
  }

  const logoUrl = `/uploads/${filename}`
  await updateGeneralSettings({ logoUrl })
  revalidatePath('/settings')
  revalidatePath('/settings', 'layout')
  revalidatePath('/', 'layout')
  return { success: true, logoUrl }
}
