import { describe, expect, it } from 'vitest'
import {
  readDeviceFormValues,
  readManagedDeviceTags,
  readModbusDevices,
} from '../../src/domain/devices/readModbusDevices'

describe('readModbusDevices', () => {
  it('keeps only ModbusTCP devices', () => {
    const devices = {
      d1: { type: 'ModbusTCP', name: 'PLC' },
      d2: { type: 'OPCUA', name: 'Other' },
      d3: 'invalid',
    }
    expect(readModbusDevices(devices).map((device) => device.id)).toEqual(['d1'])
  })
})

describe('readManagedDeviceTags', () => {
  it('maps tag records and falls back to the key when id or name is missing', () => {
    const record = {
      tags: {
        k1: {
          name: 'Temp',
          type: 'Float',
          address: 10,
          memaddress: '40001',
          extra: { floor: '1F' },
        },
      },
    }

    const [tag] = readManagedDeviceTags(record)

    expect(tag).toMatchObject({
      id: 'k1',
      name: 'Temp',
      type: 'Float',
      address: 10,
      memaddress: '40001',
      description: '',
      floor: '1F',
    })
  })

  it('returns an empty list when tags are missing', () => {
    expect(readManagedDeviceTags({})).toEqual([])
  })
})

describe('readDeviceFormValues', () => {
  it('applies the same defaults the device form always used', () => {
    expect(readDeviceFormValues({})).toEqual({
      name: '',
      address: '127.0.0.1:502',
      addressCount: 0,
      slaveid: 1,
      enabled: false,
      polling: 200,
    })
  })

  it('reads values from an existing device record', () => {
    expect(readDeviceFormValues({
      name: 'PLC',
      enabled: true,
      polling: 500,
      property: { address: '10.0.0.5:502', addressCount: 20, slaveid: 3 },
    })).toEqual({
      name: 'PLC',
      address: '10.0.0.5:502',
      addressCount: 20,
      slaveid: 3,
      enabled: true,
      polling: 500,
    })
  })
})
