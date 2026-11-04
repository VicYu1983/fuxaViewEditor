import type { FuxaConfig } from './types'
import { isRecord } from './validateFuxaConfig'
import { TOOL_SETTINGS_KEY, getToolSettings, readToolSettingsForWrite } from './toolSettings'

export const VOICE_REPEAT_MIN = 1
export const VOICE_REPEAT_MAX = 10

export type VoiceRepeatLevel = 'highhigh' | 'high' | 'low' | 'info'

export const VOICE_REPEAT_LEVELS = ['highhigh', 'high', 'low', 'info'] as const

export type VoiceRepeatSettings = Record<VoiceRepeatLevel, number>

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

export function getVoiceRepeatSettings(config: FuxaConfig): VoiceRepeatSettings {
  return normalizeVoiceRepeatSettings(getToolSettings(config)?.[VOICE_REPEAT_KEY])
}

export function saveVoiceRepeatSettings(
  config: FuxaConfig,
  value: unknown,
): FuxaConfig {
  const { extra, toolSettings } = readToolSettingsForWrite(config, '保存語音播放次數')
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
