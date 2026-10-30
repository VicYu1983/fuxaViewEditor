export const VOICE_REPEAT_MIN = 1
export const VOICE_REPEAT_MAX = 10

export function normalizeVoiceRepeat(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? '').trim(), 10)
  if (!Number.isFinite(parsed)) return VOICE_REPEAT_MIN
  return Math.min(VOICE_REPEAT_MAX, Math.max(VOICE_REPEAT_MIN, Math.round(parsed)))
}
