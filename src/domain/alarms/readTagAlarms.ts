import { isRecord } from '../shared/isRecord'
import type { TagAlarmLevel } from './manageTagAlarms'

export interface TagAlarmSetting {
  level: TagAlarmLevel
  text: string
}

const ALARM_LEVEL_KEYS: readonly TagAlarmLevel[] = ['highhigh', 'high', 'low', 'info']

function getEnabledAlarmLevels(alarm: Record<string, unknown>) {
  return ALARM_LEVEL_KEYS.flatMap((key) => {
    const level = alarm[key]
    return isRecord(level) && level.enabled === true ? [{ key, level }] : []
  })
}

export function readAlarmSettingsByTag(alarms: unknown): Map<string, TagAlarmSetting[]> {
  const settingsByTag = new Map<string, TagAlarmSetting[]>()
  if (!Array.isArray(alarms)) return settingsByTag

  for (const alarm of alarms) {
    if (!isRecord(alarm) || !isRecord(alarm.property)
        || typeof alarm.property.variableId !== 'string') continue
    const tagId = alarm.property.variableId
    const settings = getEnabledAlarmLevels(alarm).map(({ key, level }) => ({
      level: key,
      text: typeof level.text === 'string' ? level.text : '',
    }))
    if (settings.length) {
      settingsByTag.set(tagId, [...(settingsByTag.get(tagId) ?? []), ...settings])
    }
  }
  return settingsByTag
}

export function readClosedAlarmTagIds(alarms: unknown): Set<string> {
  const closedTagIds = new Set<string>()
  if (!Array.isArray(alarms)) return closedTagIds

  for (const alarm of alarms) {
    if (!isRecord(alarm) || !isRecord(alarm.property)
        || typeof alarm.property.variableId !== 'string') continue
    const hasClosedLevels = Array.isArray(alarm.closedLevels) && alarm.closedLevels.length > 0
    if (hasClosedLevels && !getEnabledAlarmLevels(alarm).length) {
      closedTagIds.add(alarm.property.variableId)
    }
  }
  return closedTagIds
}

export function readAlarmInversionByTag(alarms: unknown): Map<string, boolean> {
  const inversionByTag = new Map<string, boolean>()
  if (!Array.isArray(alarms)) return inversionByTag

  for (const alarm of alarms) {
    if (!isRecord(alarm) || !isRecord(alarm.property)
        || typeof alarm.property.variableId !== 'string') continue
    const activeLevels = getEnabledAlarmLevels(alarm).map(({ level }) => level)
    if (activeLevels.length) {
      inversionByTag.set(
        alarm.property.variableId,
        activeLevels.every((level) => level.min === 0 && level.max === 0),
      )
    }
  }
  return inversionByTag
}
