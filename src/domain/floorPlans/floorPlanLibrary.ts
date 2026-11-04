import type { FuxaConfig } from '../config/types'
import {
  TOOL_SETTINGS_KEY,
  getToolSettings,
  readToolSettingsForWrite,
} from '../config/toolSettings'
import { parseBuildingFloorName } from '../buildingFloors/buildingFloors'
import { isRecord } from '../shared/isRecord'

const FLOOR_PLAN_LIBRARY_KEY = 'floorPlans'
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PNG_IHDR_TYPE = 'IHDR'

export interface FloorPlanImage {
  mimeType: 'image/png'
  dataUrl: string
  width: number
  height: number
}

/** 以建築樓層名稱（`系統/樓層`）為 key 的平面圖底圖。 */
export type FloorPlanLibrary = Record<string, FloorPlanImage>

/** 回傳 View 名稱對應的樓層 key；不是建築樓層名稱時回傳 null。 */
export function floorPlanKeyForView(viewName: unknown): string | null {
  if (typeof viewName !== 'string') return null
  return parseBuildingFloorName(viewName) ? viewName : null
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) >>> 0)
    + (bytes[offset + 1]! << 16)
    + (bytes[offset + 2]! << 8)
    + bytes[offset + 3]!
}

/** 由 PNG 的 IHDR 區塊讀取尺寸，不需要瀏覽器解碼圖片。 */
export function createFloorPlanImage(dataUrl: unknown): FloorPlanImage {
  const invalid = new Error('平面圖必須是有效的 PNG 圖片。')
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    throw invalid
  }
  const base64 = dataUrl.slice(PNG_DATA_URL_PREFIX.length)
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw invalid

  const bytes = decodeBase64(base64)
  if (bytes.length < 24 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    throw invalid
  }
  const type = String.fromCharCode(...bytes.slice(12, 16))
  if (type !== PNG_IHDR_TYPE) throw invalid

  const width = readUint32(bytes, 16)
  const height = readUint32(bytes, 20)
  if (width <= 0 || height <= 0) throw invalid
  return { mimeType: 'image/png', dataUrl, width, height }
}

/** 將上傳的 PNG 位元組轉為 data URL（與圖示庫相同的 Base64 格式）。 */
export function createFloorPlanDataUrl(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return `${PNG_DATA_URL_PREFIX}${btoa(binary)}`
}

export function validateFloorPlanLibrary(value: unknown): FloorPlanLibrary {
  if (!isRecord(value)) {
    throw new Error(`配置的 extra.${TOOL_SETTINGS_KEY}.${FLOOR_PLAN_LIBRARY_KEY} 欄位不是物件。`)
  }
  const library: FloorPlanLibrary = {}
  for (const [key, entry] of Object.entries(value)) {
    if (floorPlanKeyForView(key) === null) {
      throw new Error(`平面圖「${key}」不是有效的建築樓層名稱（系統/樓層）。`)
    }
    if (!isRecord(entry)) throw new Error(`平面圖「${key}」格式無效。`)
    library[key] = createFloorPlanImage(entry.dataUrl)
  }
  return library
}

export function getFloorPlanLibrary(config: unknown): FloorPlanLibrary {
  const library = getToolSettings(config)?.[FLOOR_PLAN_LIBRARY_KEY]
  return library === undefined ? {} : validateFloorPlanLibrary(library)
}

export function saveFloorPlanLibrary(
  config: FuxaConfig,
  library: unknown,
): FloorPlanLibrary {
  if (!isRecord(config)) throw new Error('無效的配置資料。')
  const { extra, toolSettings } = readToolSettingsForWrite(config, '安全保存平面圖庫')
  config.extra = extra

  const validated = validateFloorPlanLibrary(library)
  extra[TOOL_SETTINGS_KEY] = {
    ...toolSettings,
    [FLOOR_PLAN_LIBRARY_KEY]: validated,
  }
  return validated
}
