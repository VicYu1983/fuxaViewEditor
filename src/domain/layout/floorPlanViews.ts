import { isRecord } from '../config/validateFuxaConfig'
import type { FuxaConfig, GridSettings, FloorGroupFrameSettings } from '../config/types'
import type { FloorLayoutComponent, FloorLayoutResult, FloorTag } from './floorLayout'
import { layoutFloorComponents } from './floorLayout'

const TOOL_SETTINGS_KEY = 'fuxaSetting'
const FLOOR_PLAN_VIEW_IDS_KEY = 'floorPlanViewIds'
const FLOOR_PLAN_TAG_OFFSETS_KEY = 'floorPlanTagOffsets'

export interface FloorPlanTagOffset {
  dx: number
  dy: number
}

export type FloorPlanTagOffsets = Record<string, FloorPlanTagOffset>

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function ensureToolSettings(config: FuxaConfig): Record<string, unknown> {
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
  extra[TOOL_SETTINGS_KEY] = toolSettings
  return toolSettings
}

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
  const toolSettings = ensureToolSettings(config)

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
  toolSettings[FLOOR_PLAN_VIEW_IDS_KEY] = ids
  return ids
}

export function getViewFloorPlanTagOffsets(config: FuxaConfig, viewId: string): FloorPlanTagOffsets {
  const byView = getToolSettings(config)?.[FLOOR_PLAN_TAG_OFFSETS_KEY]
  const offsets = isRecord(byView) ? byView[viewId] : undefined
  if (!isRecord(offsets)) return {}

  const result: FloorPlanTagOffsets = {}
  for (const [tagId, value] of Object.entries(offsets)) {
    if (isRecord(value) && isFiniteNumber(value.dx) && isFiniteNumber(value.dy)) {
      result[tagId] = { dx: value.dx, dy: value.dy }
    }
  }
  return result
}

export function saveFloorPlanTagOffsets(
  config: FuxaConfig,
  viewIds: readonly string[],
  offsetsByView: ReadonlyMap<string, FloorPlanTagOffsets>,
): void {
  const toolSettings = ensureToolSettings(config)

  const saved: Record<string, FloorPlanTagOffsets> = {}
  for (const viewId of new Set(viewIds)) {
    const offsets: FloorPlanTagOffsets = {}
    for (const [tagId, value] of Object.entries(offsetsByView.get(viewId) ?? {})) {
      if (isFiniteNumber(value?.dx) && isFiniteNumber(value?.dy)) {
        offsets[tagId] = { dx: value.dx, dy: value.dy }
      }
    }
    if (Object.keys(offsets).length > 0) saved[viewId] = offsets
  }
  if (Object.keys(saved).length === 0) {
    delete toolSettings[FLOOR_PLAN_TAG_OFFSETS_KEY]
  } else {
    toolSettings[FLOOR_PLAN_TAG_OFFSETS_KEY] = saved
  }
}

export function layoutFloorViewComponents(
  model: {
    components: FloorLayoutComponent[]
    grid: GridSettings
    floorPlan?: boolean
    floorPlanTagOffsets?: FloorPlanTagOffsets
  },
  tags: Map<string, FloorTag> | Record<string, FloorTag>,
  floorGroupFrame: FloorGroupFrameSettings,
  canvasWidth: number,
): FloorLayoutResult {
  const tagOffsets = model.floorPlan === true ? model.floorPlanTagOffsets ?? {} : {}
  return layoutFloorComponents(model.components, model.grid, tags, floorGroupFrame, canvasWidth, tagOffsets)
}
