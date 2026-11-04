import { describe, expect, it } from 'vitest'
import { readAlarmInversionByTag, readAlarmSettingsByTag } from '../../src/domain/alarms/readTagAlarms'

describe('readAlarmSettingsByTag', () => {
  it('returns only enabled levels with their text, grouped by variable id', () => {
    const alarms = [
      {
        property: { variableId: 't1' },
        highhigh: { enabled: true, text: 'HH' },
        high: { enabled: false, text: 'H' },
        low: { enabled: true },
      },
      { property: { variableId: 't1' }, info: { enabled: true, text: 'I' } },
      { property: {}, high: { enabled: true, text: 'orphan' } },
    ]

    expect(readAlarmSettingsByTag(alarms).get('t1')).toEqual([
      { level: 'highhigh', text: 'HH' },
      { level: 'low', text: '' },
      { level: 'info', text: 'I' },
    ])
    expect(readAlarmSettingsByTag(alarms).size).toBe(1)
  })

  it('returns an empty map when alarms is not an array', () => {
    expect(readAlarmSettingsByTag(undefined).size).toBe(0)
  })
})

describe('readAlarmInversionByTag', () => {
  it('marks a tag inverted only when every enabled level has min and max of zero', () => {
    const alarms = [
      { property: { variableId: 'inverted' }, high: { enabled: true, min: 0, max: 0 } },
      {
        property: { variableId: 'normal' },
        high: { enabled: true, min: 0, max: 0 },
        low: { enabled: true, min: 1, max: 5 },
      },
      { property: { variableId: 'disabled' }, high: { enabled: false, min: 0, max: 0 } },
    ]

    const inversion = readAlarmInversionByTag(alarms)

    expect(inversion.get('inverted')).toBe(true)
    expect(inversion.get('normal')).toBe(false)
    expect(inversion.has('disabled')).toBe(false)
  })
})
