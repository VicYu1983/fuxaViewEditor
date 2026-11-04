// Here, floor means a Tag group within one View, not a cross-View building floor.
import { isRecord } from '../config/validateFuxaConfig'
import type { FuxaConfig, FloorGroupFrameSettings } from '../config/types'
import {
  TOOL_SETTINGS_KEY,
  getToolSettings,
  readToolSettingsForWrite,
} from '../config/toolSettings'

export const DEFAULT_FLOOR_GROUP_FRAME: Readonly<FloorGroupFrameSettings> = Object.freeze({
  fill: '#eff6ff',
  fillOpacity: 0.55,
  stroke: '#93c5fd',
  strokeWidth: 1,
  cornerRadius: 12,
  padding: 16,
})

const FLOOR_FRAME_SETTINGS_KEY = 'floorGroupFrames'
const FLOOR_FRAME_LAYOUT_VERSION_KEY = 'floorFrameLayoutVersion'
export const FLOOR_FRAME_LAYOUT_VERSION = 1

export function hasCurrentFloorFrameLayout(config: FuxaConfig): boolean {
  return getToolSettings(config)?.[FLOOR_FRAME_LAYOUT_VERSION_KEY]
    === FLOOR_FRAME_LAYOUT_VERSION
}

export function saveFloorFrameLayoutVersion(config: FuxaConfig): void {
  const { extra, toolSettings } = readToolSettingsForWrite(config, '安全保存樓層底框版面版本')
  extra[TOOL_SETTINGS_KEY] = {
    ...toolSettings,
    [FLOOR_FRAME_LAYOUT_VERSION_KEY]: FLOOR_FRAME_LAYOUT_VERSION,
  }
  config.extra = extra
}

export function normalizeFloorGroupFrameSettings(settings: unknown): FloorGroupFrameSettings {
  const frame: FloorGroupFrameSettings = { ...DEFAULT_FLOOR_GROUP_FRAME }
  if (!isRecord(settings)) return frame

  for (const key of ['fill', 'stroke'] as const) {
    const value = settings[key]
    if (typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) {
      frame[key] = value.toLowerCase()
    }
  }

  for (const key of ['fillOpacity', 'strokeWidth', 'cornerRadius', 'padding'] as const) {
    const value = settings[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    if (key === 'fillOpacity' && value >= 0 && value <= 1) frame[key] = value
    else if (key === 'strokeWidth' && value >= 0 && value <= 10) frame[key] = value
    else if (key === 'cornerRadius' && value >= 0 && value <= 100) frame[key] = value
    else if (key === 'padding' && value >= 0 && value <= 200) frame[key] = value
  }

  return frame
}

export function getFloorGroupFrameSettings(config: FuxaConfig): FloorGroupFrameSettings {
  return normalizeFloorGroupFrameSettings(getToolSettings(config)?.[FLOOR_FRAME_SETTINGS_KEY])
}

export function saveFloorGroupFrameSettings(
  config: FuxaConfig,
  settings: unknown,
): FloorGroupFrameSettings {
  const { extra, toolSettings } = readToolSettingsForWrite(config, '安全保存樓層底框設定')
  config.extra = extra

  const currentFrameSettings = toolSettings[FLOOR_FRAME_SETTINGS_KEY]
  if (currentFrameSettings !== undefined && !isRecord(currentFrameSettings)) {
    throw new Error(
      `配置的 extra.${TOOL_SETTINGS_KEY}.${FLOOR_FRAME_SETTINGS_KEY} 欄位不是物件，無法安全保存樓層底框設定。`,
    )
  }

  const normalized = normalizeFloorGroupFrameSettings(settings)
  extra[TOOL_SETTINGS_KEY] = { ...toolSettings, [FLOOR_FRAME_SETTINGS_KEY]: normalized }
  return normalized
}
