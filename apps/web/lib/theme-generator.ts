// Basic hex to HSL conversion
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let r = 0
  let g = 0
  let b = 0
  if (hex.length === 4) {
    r = Number.parseInt(`0x${hex[1]}${hex[1]}`)
    g = Number.parseInt(`0x${hex[2]}${hex[2]}`)
    b = Number.parseInt(`0x${hex[3]}${hex[3]}`)
  } else if (hex.length === 7) {
    r = Number.parseInt(`0x${hex[1]}${hex[2]}`)
    g = Number.parseInt(`0x${hex[3]}${hex[4]}`)
    b = Number.parseInt(`0x${hex[5]}${hex[6]}`)
  }

  r /= 255
  g /= 255
  b /= 255

  const cmin = Math.min(r, g, b)
  const cmax = Math.max(r, g, b)
  const delta = cmax - cmin
  let h = 0
  let s = 0
  let l = 0

  if (delta === 0) h = 0
  else if (cmax === r) h = ((g - b) / delta) % 6
  else if (cmax === g) h = (b - r) / delta + 2
  else h = (r - g) / delta + 4

  h = Math.round(h * 60)
  if (h < 0) h += 360

  l = (cmax + cmin) / 2
  s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  s = +(s * 100).toFixed(1)
  l = +(l * 100).toFixed(1)

  return { h, s, l }
}

export function generateThemeVariables(
  baseColor: string | undefined, // Hex color
  mode: 'light' | 'dark'
): Record<string, string> {
  const defaults = {
    // Fallback/Default Blue
    h: 211,
    s: 100,
    l: 50,
  }

  let h = defaults.h
  let s = defaults.s
  let l = defaults.l

  if (baseColor && /^#[0-9A-Fa-f]{6}$/.test(baseColor)) {
    const hsl = hexToHsl(baseColor)
    h = hsl.h
    s = hsl.s
    l = hsl.l
  }

  // Adjust lightness for dark mode if base is too dark/light?
  // For now we trust the base color as the "primary"

  if (mode === 'light') {
    return {
      '--background': '0 0% 100%',
      '--foreground': '0 0% 9%',
      '--card': '0 0% 100%',
      '--card-foreground': '0 0% 9%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '0 0% 9%',
      '--primary': `${h} ${s}% ${l}%`,
      '--primary-foreground': '0 0% 100%', // Assuming primary is dark enough for white text
      '--secondary': `${h} ${Math.max(0, s - 80)}% 96%`,
      '--secondary-foreground': `${h} ${s}% 9%`,
      '--muted': `${h} ${Math.max(0, s - 80)}% 96%`,
      '--muted-foreground': '220 9% 25%', // Neutral darker grey
      '--accent': `${h} ${Math.max(0, s - 80)}% 96%`,
      '--accent-foreground': `${h} ${s}% 9%`,
      '--destructive': '0 84% 60%',
      '--destructive-foreground': '0 0% 100%',
      '--border': `${h} ${Math.max(0, s - 80)}% 90%`,
      '--input': `${h} ${Math.max(0, s - 80)}% 90%`,
      '--ring': `${h} ${s}% ${l}%`,
      '--radius': '0.5rem',
    }
  }
  return {
    '--background': `${h} ${Math.max(0, s - 70)}% 5%`,
    '--foreground': `${h} ${Math.max(0, s - 80)}% 98%`,
    '--card': `${h} ${Math.max(0, s - 70)}% 8%`,
    '--card-foreground': `${h} ${Math.max(0, s - 80)}% 98%`,
    '--popover': `${h} ${Math.max(0, s - 70)}% 8%`,
    '--popover-foreground': `${h} ${Math.max(0, s - 80)}% 98%`,
    '--primary': `${h} ${s}% ${l}%`,
    '--primary-foreground': '0 0% 100%',
    '--secondary': `${h} ${Math.max(0, s - 70)}% 15%`,
    '--secondary-foreground': `${h} ${Math.max(0, s - 80)}% 98%`,
    '--muted': `${h} ${Math.max(0, s - 70)}% 15%`,
    '--muted-foreground': `${h} ${Math.max(0, s - 60)}% 65%`,
    '--accent': `${h} ${Math.max(0, s - 70)}% 15%`,
    '--accent-foreground': `${h} ${Math.max(0, s - 80)}% 98%`,
    '--destructive': '0 62% 45%',
    '--destructive-foreground': '0 0% 100%',
    '--border': `${h} ${Math.max(0, s - 70)}% 18%`,
    '--input': `${h} ${Math.max(0, s - 70)}% 18%`,
    '--ring': `${h} ${s}% ${l}%`,
    '--radius': '0.5rem',
  }
}
