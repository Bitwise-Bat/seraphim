export const color_presets = [
  '#1b1b1f',
  '#ffffff',
  '#f0605a',
  '#f59e0b',
  '#eab308',
  '#5ce0a0',
  '#7aa2ff',
  '#a855f7',
] as const

export function to_hex(channel: number): string {
  return Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16)
    .padStart(2, '0')
}

export function normalize_hex(input: string): string | undefined {
  const cleaned = input.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return `#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`.toLowerCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned}`.toLowerCase()
  }
  return undefined
}

export function hex_to_hsv(hex: string): [number, number, number] {
  const valid = normalize_hex(hex) ?? '#000000'
  const r = parseInt(valid.slice(1, 3), 16) / 255
  const g = parseInt(valid.slice(3, 5), 16) / 255
  const b = parseInt(valid.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  const s = max === 0 ? 0 : d / max
  return [h, s, max]
}

export function hsv_to_hex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return `#${to_hex(r + m)}${to_hex(g + m)}${to_hex(b + m)}`
}
