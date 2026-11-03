import { describe, expect, it } from 'vitest'
import type { FuxaConfig } from '../../../src/domain/config/types'
import { moveModbusDeviceTags } from '../../../src/features/devices/moveDeviceTags'

function createConfig(): FuxaConfig {
  return {
    devices: {
      source: {
        id: 'source',
        type: 'ModbusTCP',
        tags: {
          'tag-1': { id: 'tag-1', name: 'Pump', type: 'Bool', address: 1, memaddress: '000000', timestamp: 1, extra: { floor: '2F' } },
          'tag-2': { id: 'tag-2', name: 'Fan', type: 'Bool', address: 2, memaddress: '000000', timestamp: 1 },
        },
      },
      target: {
        id: 'target',
        type: 'ModbusTCP',
        tags: {
          'tag-9': { id: 'tag-9', name: 'Valve', type: 'Bool', address: 9, memaddress: '000000', timestamp: 1 },
        },
      },
      other: {
        id: 'other',
        type: 'ModbusTCP',
        tags: {
          'tag-7': { id: 'tag-7', name: 'Fan_1', type: 'Bool', address: 7, memaddress: '000000', timestamp: 1 },
        },
      },
    },
    hmi: { views: [] },
  }
}

function tagsOf(config: FuxaConfig, deviceId: string): Record<string, Record<string, unknown>> {
  return (config.devices[deviceId] as { tags: Record<string, Record<string, unknown>> }).tags
}

describe('moveModbusDeviceTags', () => {
  it('moves selected tags keeping their id and fields, and removes them from the source', () => {
    const source = createConfig()
    const result = moveModbusDeviceTags(source, 'source', 'target', ['tag-1'], () => 50)

    expect(result.moved).toBe(1)
    expect(result.renamed).toEqual([])
    expect(tagsOf(result.config, 'source')['tag-1']).toBeUndefined()
    expect(tagsOf(result.config, 'target')['tag-1']).toMatchObject({
      id: 'tag-1',
      name: 'Pump',
      address: 1,
      timestamp: 50,
      extra: { floor: '2F' },
    })
    expect(tagsOf(result.config, 'source')['tag-2']).toBeDefined()
  })

  it('does not mutate the source config', () => {
    const source = createConfig()
    moveModbusDeviceTags(source, 'source', 'target', ['tag-1', 'tag-2'])

    expect(tagsOf(source, 'source')['tag-1']).toBeDefined()
    expect(tagsOf(source, 'target')['tag-1']).toBeUndefined()
  })

  it('appends _1, _2 when the name already exists in any device, ignoring case and spaces', () => {
    const source = createConfig()
    source.devices.target = {
      id: 'target',
      type: 'ModbusTCP',
      tags: { 'tag-9': { id: 'tag-9', name: ' fan ', type: 'Bool', address: 9 } },
    }
    const result = moveModbusDeviceTags(source, 'source', 'target', ['tag-2'])

    expect(result.renamed).toEqual([{ tagId: 'tag-2', from: 'Fan', to: 'Fan_2' }])
    expect(tagsOf(result.config, 'target')['tag-2']).toMatchObject({ id: 'tag-2', name: 'Fan_2' })
  })

  it('does not treat the moved tags own names as conflicts', () => {
    const source = createConfig()
    const result = moveModbusDeviceTags(source, 'source', 'target', ['tag-1', 'tag-2'])

    expect(result.renamed).toEqual([])
    expect(result.moved).toBe(2)
  })

  it('rejects same source and target, empty selection, unknown tags and non-Modbus devices', () => {
    const source = createConfig()
    source.devices.plc = { id: 'plc', type: 'Siemens', tags: {} }

    expect(() => moveModbusDeviceTags(source, 'source', 'source', ['tag-1'])).toThrow('來源與目標設備不可相同。')
    expect(() => moveModbusDeviceTags(source, 'source', 'target', [])).toThrow('請先選取要移動的 Tag。')
    expect(() => moveModbusDeviceTags(source, 'source', 'target', ['missing'])).toThrow('找不到要移動的 Tag。')
    expect(() => moveModbusDeviceTags(source, 'source', 'plc', ['tag-1'])).toThrow('找不到所選的 ModbusTCP 設備。')
  })
})
