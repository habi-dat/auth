import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const CHAR_MAP: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss',
  Ä: 'ae', Ö: 'oe', Ü: 'ue',
  à: 'a', á: 'a', â: 'a', ã: 'a', å: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o',
  ù: 'u', ú: 'u', û: 'u',
  ñ: 'n', ç: 'c', ý: 'y', ÿ: 'y',
  ð: 'd', ø: 'o', þ: 'th', æ: 'ae',
}

/**
 * Convert a display name into a URL-safe slug / username.
 * Replaces German umlauts and common diacritics, lowercases,
 * converts spaces to the given separator, and strips everything
 * that isn't alphanumeric or the separator.
 */
export function slugify(value: string, separator = '-'): string {
  let result = value.toLowerCase()
  result = result.replace(/./g, (ch) => CHAR_MAP[ch] ?? ch)
  result = result.replace(/\s+/g, separator)
  const escaped = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  result = result.replace(new RegExp(`[^a-z0-9${escaped}]`, 'g'), '')
  result = result.replace(new RegExp(`${escaped}{2,}`, 'g'), separator)
  result = result.replace(new RegExp(`^${escaped}|${escaped}$`, 'g'), '')
  return result
}
