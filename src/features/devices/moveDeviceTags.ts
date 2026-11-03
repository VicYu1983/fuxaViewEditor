import type { FuxaConfig } from '../../domain/config/types'
import { isRecord } from '../../domain/config/validateFuxaConfig'

export interface MovedDeviceTagRename {
  tagId: string
  from: string
  to: string
}

export interface MoveDeviceTagsResult {
  config: FuxaConfig
  moved: number
  renamed: MovedDeviceTagRename[]
}

function normalizeTagName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

function getModbusDevice(config: FuxaConfig, deviceId: string): Record<string, unknown> {
  const device = config.devices[deviceId]
  if (!isRecord(device) || device.type !== 'ModbusTCP') {
    throw new Error('找不到所選的 ModbusTCP 設備。')
  }
  if (!isRecord(device.tags)) device.tags = {}
  return device
}

function findTagEntry(
  tags: Record<string, unknown>,
  tagId: string,
): [string, Record<string, unknown>] | undefined {
  const entry = Object.entries(tags).find(([key, value]) => (
    key === tagId || (isRecord(value) && value.id === tagId)
  ))
  return entry && isRecord(entry[1]) ? [entry[0], entry[1]] : undefined
}

function collectTagNames(config: FuxaConfig): Set<string> {
  const names = new Set<string>()
  for (const device of Object.values(config.devices)) {
    if (!isRecord(device) || !isRecord(device.tags)) continue
    for (const tag of Object.values(device.tags)) {
      if (isRecord(tag) && typeof tag.name === 'string') names.add(normalizeTagName(tag.name))
    }
  }
  return names
}

export function moveModbusDeviceTags(
  source: FuxaConfig,
  sourceDeviceId: string,
  targetDeviceId: string,
  tagIds: readonly string[],
  now = Date.now,
): MoveDeviceTagsResult {
  if (sourceDeviceId === targetDeviceId) throw new Error('來源與目標設備不可相同。')
  const uniqueTagIds = [...new Set(tagIds)]
  if (!uniqueTagIds.length) throw new Error('請先選取要移動的 Tag。')

  const config = structuredClone(source)
  const sourceDevice = getModbusDevice(config, sourceDeviceId)
  const targetDevice = getModbusDevice(config, targetDeviceId)
  const sourceTags = sourceDevice.tags as Record<string, unknown>
  const targetTags = targetDevice.tags as Record<string, unknown>

  const moving: Array<{ tagId: string; record: Record<string, unknown> }> = []
  for (const tagId of uniqueTagIds) {
    const entry = findTagEntry(sourceTags, tagId)
    if (!entry) throw new Error('找不到要移動的 Tag。')
    delete sourceTags[entry[0]]
    moving.push({ tagId, record: entry[1] })
  }

  const usedNames = collectTagNames(config)
  const renamed: MovedDeviceTagRename[] = []
  for (const { tagId, record } of moving) {
    const from = typeof record.name === 'string' ? record.name : ''
    let to = from
    if (usedNames.has(normalizeTagName(from))) {
      let index = 1
      while (usedNames.has(normalizeTagName(`${from}_${index}`))) index++
      to = `${from}_${index}`
      record.name = to
      renamed.push({ tagId, from, to })
    }
    usedNames.add(normalizeTagName(to))
    record.id = tagId
    record.timestamp = now()
    targetTags[tagId] = record
  }

  return { config, moved: moving.length, renamed }
}
