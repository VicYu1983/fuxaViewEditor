import type { FuxaConfig } from './types'
import { isRecord } from '../shared/isRecord'

export { isRecord }

export function isFuxaConfig(value: unknown): value is FuxaConfig {
  if (
    !isRecord(value)
    || !isRecord(value.devices)
    || !isRecord(value.hmi)
    || !Array.isArray(value.hmi.views)
  ) {
    return false
  }

  return true
}

export function validateFuxaConfig(value: unknown): FuxaConfig {
  if (!isFuxaConfig(value)) {
    throw new Error('檔案不是可辨識的 FUXA 配置（需包含 devices 與 hmi.views）。')
  }
  return value
}
