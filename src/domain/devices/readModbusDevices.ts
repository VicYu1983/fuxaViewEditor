import { isRecord } from '../shared/isRecord'
import { sortTagEntriesByAddress } from './deviceTagAddressSort'

export interface ModbusDeviceEntry {
  id: string
  record: Record<string, unknown>
}

export interface ManagedDeviceTag {
  id: string
  name: string
  type: string
  address: unknown
  memaddress: string
  description: string
  floor: string
  record: Record<string, unknown>
}

export interface ModbusDeviceFormValues {
  [key: string]: unknown
  name: string
  address: string
  addressCount: number
  slaveid: number
  enabled: boolean
  polling: number
}

export function readModbusDevices(devices: Record<string, unknown>): ModbusDeviceEntry[] {
  return Object.entries(devices)
    .filter((entry): entry is [string, Record<string, unknown>] => (
      isRecord(entry[1]) && entry[1].type === 'ModbusTCP'
    ))
    .map(([id, record]) => ({ id, record }))
}

export function readManagedDeviceTags(record: Record<string, unknown>): ManagedDeviceTag[] {
  if (!isRecord(record.tags)) return []
  return sortTagEntriesByAddress(Object.entries(record.tags))
    .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
    .map(([key, tag]) => ({
      id: typeof tag.id === 'string' ? tag.id : key,
      name: typeof tag.name === 'string' ? tag.name : key,
      type: typeof tag.type === 'string' ? tag.type : '',
      address: tag.address,
      memaddress: typeof tag.memaddress === 'string' ? tag.memaddress : '',
      description: typeof tag.description === 'string' ? tag.description : '',
      floor: isRecord(tag.extra) && typeof tag.extra.floor === 'string' ? tag.extra.floor : '',
      record: tag,
    }))
}

export function readDeviceFormValues(record: Record<string, unknown>): ModbusDeviceFormValues {
  const property = isRecord(record.property) ? record.property : undefined
  return {
    name: typeof record.name === 'string' ? record.name : '',
    address: property && typeof property.address === 'string' ? property.address : '127.0.0.1:502',
    addressCount: property ? Number(property.addressCount) || 0 : 0,
    slaveid: property ? Number(property.slaveid) || 1 : 1,
    enabled: Boolean(record.enabled),
    polling: Number(record.polling) || 200,
  }
}
