import { describe, expect, it } from 'vitest'
import type { FuxaConfig } from '../../src/domain/config/types'
import {
  TOOL_SETTINGS_OUTDATED_MESSAGE,
  TOOL_SETTINGS_VERSION,
  getToolSettings,
  getToolSettingsOutdatedWarning,
  getToolSettingsVersion,
  isToolSettingsOutdated,
  nextToolSettingsVersion,
  readToolSettingsForWrite,
} from '../../src/domain/config/toolSettings'
import { saveViewGridSettings } from '../../src/domain/layout/gridSettings'
import { saveFloorPlanViewSettings } from '../../src/domain/layout/floorPlanViews'

function config(extra?: unknown): FuxaConfig {
  const value: FuxaConfig = { devices: {}, hmi: { views: [] } }
  if (extra !== undefined) value.extra = extra
  return value
}

describe('toolSettings', () => {
  it('reads leniently when extra or fuxaSetting is missing or invalid', () => {
    expect(getToolSettings(config())).toBeUndefined()
    expect(getToolSettings(config('x'))).toBeUndefined()
    expect(getToolSettings(config({ fuxaSetting: [] }))).toBeUndefined()
    expect(getToolSettings(config({ fuxaSetting: { a: 1 } }))).toEqual({ a: 1 })
  })

  it('validates strictly for writing, with the action in the message', () => {
    expect(() => readToolSettingsForWrite(config('x'), '安全保存測試'))
      .toThrow('配置的 extra 欄位不是物件，無法安全保存測試。')
    expect(() => readToolSettingsForWrite(config({ fuxaSetting: 1 }), '安全保存測試'))
      .toThrow('配置的 extra.fuxaSetting 欄位不是物件，無法安全保存測試。')
  })

  it('returns fresh empty objects without mutating the config', () => {
    const source = config()
    const result = readToolSettingsForWrite(source, '安全保存測試')
    expect(result).toEqual({ extra: {}, toolSettings: {} })
    expect(source.extra).toBeUndefined()
  })

  it('treats a missing version as the current version', () => {
    expect(getToolSettingsVersion(config())).toBe(TOOL_SETTINGS_VERSION)
    expect(getToolSettingsVersion(config({ fuxaSetting: { version: 'x' } })))
      .toBe(TOOL_SETTINGS_VERSION)
    expect(isToolSettingsOutdated(config({ fuxaSetting: {} }))).toBe(false)
  })

  it('INV-10: warns when the file is newer than the tool, without blocking', () => {
    const newer = config({ fuxaSetting: { version: TOOL_SETTINGS_VERSION + 1 } })
    expect(isToolSettingsOutdated(newer)).toBe(true)
    expect(getToolSettingsOutdatedWarning(newer)).toBe(TOOL_SETTINGS_OUTDATED_MESSAGE)
    expect(getToolSettingsOutdatedWarning(config({ fuxaSetting: { version: 1 } }))).toBeUndefined()
  })

  it('INV-10: never downgrades a newer version and keeps unknown keys', () => {
    const newer = config({
      other: { keep: true },
      fuxaSetting: { version: 7, futureKey: { a: 1 } },
    })
    saveViewGridSettings(newer, ['v1'], new Map())
    saveFloorPlanViewSettings(newer, ['v1'], new Map([['v1', true]]))

    expect(newer.extra).toMatchObject({
      other: { keep: true },
      fuxaSetting: { version: 7, futureKey: { a: 1 }, floorPlanViewIds: ['v1'] },
    })
    expect(nextToolSettingsVersion({ version: 7 })).toBe(7)
    expect(nextToolSettingsVersion({})).toBe(TOOL_SETTINGS_VERSION)
    expect(nextToolSettingsVersion({ version: 0 })).toBe(TOOL_SETTINGS_VERSION)
  })

  it('writes the current version for files without one', () => {
    const source = config()
    saveViewGridSettings(source, ['v1'], new Map())
    expect(getToolSettings(source)?.version).toBe(TOOL_SETTINGS_VERSION)
  })
})
