// The browser decodes sounds, so these are the formats Chromium can play.
const sound_extensions = new Set(['wav', 'mp3', 'ogg', 'oga', 'opus', 'flac', 'm4a', 'aac', 'webm'])

export function is_sound_name(name: string): boolean {
  const dot = name.lastIndexOf('.')
  return dot > 0 && sound_extensions.has(name.slice(dot + 1).toLowerCase())
}
