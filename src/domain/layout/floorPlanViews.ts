import { isRecord } from '../config/validateFuxaConfig'
import type { FuxaConfig } from '../config/types'

const TOOL_SETTINGS_KEY = 'fuxaSetting'
const FLOOR_PLAN_VIEW_IDS_KEY = 'floorPlanViewIds'

function getToolSettings(config: FuxaConfig): Record<string, unknown> | undefined {
  if (!isRecord(config.extra) || !isRecord(config.extra[TOOL_SETTINGS_KEY])) return undefined
  return config.extra[TOOL_SETTINGS_KEY]
}

export function getViewFloorPlanSetting(config: FuxaConfig, viewId: string): boolean {
  const ids = getToolSettings(config)?.[FLOOR_PLAN_VIEW_IDS_KEY]
  return Array.isArray(ids) && ids.includes(viewId)
}

export function saveFloorPlanViewSettings(
  config: FuxaConfig,
  viewIds: readonly string[],
  flags: ReadonlyMap<string, boolean>,
): string[] {
  if (config.extra !== undefined && !isRecord(config.extra)) {
    throw new Error('配置的 extra 欄位不是物件，無法安全保存平面圖 View 設定。')
  }
  const extra = isRecord(config.extra) ? config.extra : {}
  config.extra = extra

  const currentToolSettings = extra[TOOL_SETTINGS_KEY]
  if (currentToolSettings !== undefined && !isRecord(currentToolSettings)) {
    throw new Error(`配置的 extra.${TOOL_SETTINGS_KEY} 欄位不是物件，無法安全保存平面圖 View 設定。`)
  }
  const toolSettings = isRecord(currentToolSettings) ? currentToolSettings : {}

  const activeViewIds = new Set(viewIds)
  const current = Array.isArray(toolSettings[FLOOR_PLAN_VIEW_IDS_KEY])
    ? toolSettings[FLOOR_PLAN_VIEW_IDS_KEY].filter((id): id is string => typeof id === 'string')
    : []
  const next = new Set(current.filter((id) => activeViewIds.has(id)))
  for (const [viewId, enabled] of flags) {
    if (!activeViewIds.has(viewId)) continue
    if (enabled) next.add(viewId)
    else next.delete(viewId)
  }

  const ids = [...next]
  extra[TOOL_SETTINGS_KEY] = { ...toolSettings, [FLOOR_PLAN_VIEW_IDS_KEY]: ids }
  return ids
}
