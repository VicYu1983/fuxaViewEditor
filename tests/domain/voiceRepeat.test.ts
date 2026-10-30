import { describe, expect, it } from 'vitest'
import type { FuxaConfig } from '../../src/domain/config/types'
import {
  defaultVoiceRepeatSettings,
  getVoiceRepeatSettings,
  normalizeVoiceRepeat,
  normalizeVoiceRepeatSettings,
  saveVoiceRepeatSettings,
} from '../../src/domain/config/voiceRepeat'

function createConfig(): FuxaConfig {
  return { devices: {}, hmi: { views: [] } }
}

describe('normalizeVoiceRepeat', () => {
  it('clamps values into the supported range and falls back to one', () => {
    expect(normalizeVoiceRepeat(3)).toBe(3)
    expect(normalizeVoiceRepeat('5')).toBe(5)
    expect(normalizeVoiceRepeat(0)).toBe(1)
    expect(normalizeVoiceRepeat(99)).toBe(10)
    expect(normalizeVoiceRepeat('abc')).toBe(1)
    expect(normalizeVoiceRepeat(undefined)).toBe(1)
    expect(normalizeVoiceRepeat(2.6)).toBe(3)
  })
})

describe('normalizeVoiceRepeatSettings', () => {
  it('fills missing levels with one and clamps provided values', () => {
    expect(normalizeVoiceRepeatSettings(undefined)).toEqual(defaultVoiceRepeatSettings())
    expect(normalizeVoiceRepeatSettings({ highhigh: 4, low: 99 })).toEqual({
      highhigh: 4,
      high: 1,
      low: 10,
      info: 1,
    })
  })
})

describe('getVoiceRepeatSettings', () => {
  it('returns defaults when extra has no stored settings', () => {
    expect(getVoiceRepeatSettings(createConfig())).toEqual(defaultVoiceRepeatSettings())
  })

  it('reads the settings stored in extra.fuxaSetting.voiceRepeat', () => {
    const config = createConfig()
    config.extra = {
      fuxaSetting: { voiceRepeat: { highhigh: 3, high: 5, low: 2, info: 4 } },
    }

    expect(getVoiceRepeatSettings(config)).toEqual({
      highhigh: 3,
      high: 5,
      low: 2,
      info: 4,
    })
  })
})

describe('saveVoiceRepeatSettings', () => {
  it('writes the settings into extra without touching alarms', () => {
    const source = createConfig()
    source.extra = { preserve: true, fuxaSetting: { keep: 'also' } }
    source.alarms = [{ property: { variableId: 'tag-1' } }]

    const result = saveVoiceRepeatSettings(source, {
      highhigh: 3,
      high: 5,
      low: 2,
      info: 4,
    })

    expect(result.extra).toEqual({
      preserve: true,
      fuxaSetting: {
        keep: 'also',
        voiceRepeat: { highhigh: 3, high: 5, low: 2, info: 4 },
      },
    })
    expect(result.alarms).toEqual(source.alarms)
    expect(source.extra).toEqual({ preserve: true, fuxaSetting: { keep: 'also' } })
  })

  it('creates extra and fuxaSetting when they are missing', () => {
    const result = saveVoiceRepeatSettings(createConfig(), { high: 7 })

    expect(result.extra).toEqual({
      fuxaSetting: { voiceRepeat: { highhigh: 1, high: 7, low: 1, info: 1 } },
    })
  })

  it('rejects malformed extra instead of overwriting it', () => {
    const source = createConfig()
    source.extra = 'not-an-object'
    expect(() => saveVoiceRepeatSettings(source, { high: 2 }))
      .toThrow('extra 欄位不是物件')

    const malformedTool = createConfig()
    malformedTool.extra = { fuxaSetting: [] }
    expect(() => saveVoiceRepeatSettings(malformedTool, { high: 2 }))
      .toThrow('extra.fuxaSetting 欄位不是物件')
  })
})
