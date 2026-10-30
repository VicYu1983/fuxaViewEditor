import type { FuxaConfig } from './types'
import { isRecord } from './validateFuxaConfig'

export const VOICE_REPEAT_MIN = 1
export const VOICE_REPEAT_MAX = 10

export type VoiceRepeatLevel = 'highhigh' | 'high' | 'low' | 'info'

export const VOICE_REPEAT_LEVELS = ['highhigh', 'high', 'low', 'info'] as const

export type VoiceRepeatSettings = Record<VoiceRepeatLevel, number>

const TOOL_SETTINGS_KEY = 'fuxaSetting'
const VOICE_REPEAT_KEY = 'voiceRepeat'

export function normalizeVoiceRepeat(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? '').trim(), 10)
  if (!Number.isFinite(parsed)) return VOICE_REPEAT_MIN
  return Math.min(VOICE_REPEAT_MAX, Math.max(VOICE_REPEAT_MIN, Math.round(parsed)))
}

export function defaultVoiceRepeatSettings(): VoiceRepeatSettings {
  return { highhigh: 1, high: 1, low: 1, info: 1 }
}

export function normalizeVoiceRepeatSettings(value: unknown): VoiceRepeatSettings {
  const settings = defaultVoiceRepeatSettings()
  if (!isRecord(value)) return settings
  for (const level of VOICE_REPEAT_LEVELS) {
    if (value[level] === undefined) continue
    settings[level] = normalizeVoiceRepeat(value[level])
  }
  return settings
}

function getToolSettings(config: FuxaConfig): Record<string, unknown> | undefined {
  if (!isRecord(config.extra) || !isRecord(config.extra[TOOL_SETTINGS_KEY])) return undefined
  return config.extra[TOOL_SETTINGS_KEY]
}

export function getVoiceRepeatSettings(config: FuxaConfig): VoiceRepeatSettings {
  return normalizeVoiceRepeatSettings(getToolSettings(config)?.[VOICE_REPEAT_KEY])
}

export function saveVoiceRepeatSettings(
  config: FuxaConfig,
  value: unknown,
): FuxaConfig {
  if (config.extra !== undefined && !isRecord(config.extra)) {
    throw new Error('配置的 extra 欄位不是物件，無法保存語音播放次數。')
  }
  const extra = isRecord(config.extra) ? config.extra : {}
  const currentToolSettings = extra[TOOL_SETTINGS_KEY]
  if (currentToolSettings !== undefined && !isRecord(currentToolSettings)) {
    throw new Error(`配置的 extra.${TOOL_SETTINGS_KEY} 欄位不是物件，無法保存語音播放次數。`)
  }
  const toolSettings = isRecord(currentToolSettings) ? currentToolSettings : {}
  const normalized = normalizeVoiceRepeatSettings(value)
  const output = structuredClone(config)
  output.extra = {
    ...extra,
    [TOOL_SETTINGS_KEY]: {
      ...toolSettings,
      [VOICE_REPEAT_KEY]: normalized,
    },
  }
  return output
}
