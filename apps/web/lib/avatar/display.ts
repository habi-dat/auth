export function avatarDisplaySrc(
  image?: string | null,
  updatedAt?: Date | string | number | null
): string | undefined {
  if (!image) return undefined
  if (updatedAt == null) return image
  const v =
    updatedAt instanceof Date
      ? updatedAt.getTime()
      : typeof updatedAt === 'number'
        ? updatedAt
        : new Date(updatedAt).getTime()
  if (Number.isNaN(v)) return image
  const sep = image.includes('?') ? '&' : '?'
  return `${image}${sep}v=${v}`
}

export function userInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
