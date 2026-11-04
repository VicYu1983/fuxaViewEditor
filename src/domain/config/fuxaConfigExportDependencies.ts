import type { FuxaConfig } from './types'
import { isRecord } from '../shared/isRecord'
import { getErrorMessage } from '../shared/getErrorMessage'
import { buildTagIndex } from '../tags/index'
import { generateId, type RandomValuesProvider } from '../ids'
import {
  getIconAssets,
  getIconLibrary,
  validateIconLibrary,
} from '../icons/iconLibrary'
import type { IconAsset } from '../icons/iconLibrary'
import {
  floorPlanKeyForView,
  getFloorPlanLibrary,
} from '../floorPlans/floorPlanLibrary'
import { applyModelToView } from '../svg/applyModelToView'
import type { ApplyModelView } from '../svg/applyModelToView'
import type { SvgIdAllocator, IconAssetResolver } from '../svg/buildComponentNodes'
import { parseSvg } from '../svg/parseSvg'
import type { SvgParserConstructor } from '../svg/parseSvg'
import { validateGeneratedViews, type GeneratedView } from '../svg/validateGeneratedView'
import type {
  ExportViewModel,
  PrepareFuxaConfigExportDependencies,
} from './prepareFuxaConfigExport'
import {
  getFloorGroupFrameSettings,
  saveFloorFrameLayoutVersion,
} from '../layout/floorGroupFrame'
import type { FloorGroupFrameSettings } from './types'
import { alignFloorFramesToCanvas } from '../svg/alignFloorFramesToCanvas'
import {
  buildingFloorButtonsNeedSync,
  syncBuildingFloorButtons,
} from '../buildingFloors/buildingFloorButtons'

export interface FuxaConfigExportRuntime {
  Parser: SvgParserConstructor
  serialize: (doc: XMLDocument) => string
  crypto: RandomValuesProvider
  iconLibrary?: unknown
  floorGroupFrame?: FloorGroupFrameSettings
}

function isApplyModelView(value: Record<string, unknown>): value is Record<string, unknown> & ApplyModelView {
  return typeof value.id === 'string'
    && typeof value.svgcontent === 'string'
    && isRecord(value.items)
}

function isGeneratedView(value: unknown): value is GeneratedView {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.svgcontent === 'string'
}

function iconResolver(config: FuxaConfig, iconLibrary: unknown): IconAssetResolver {
  const assets = new Map<string, IconAsset>()
  const icons = iconLibrary === undefined
    ? getIconLibrary(config)
    : validateIconLibrary(iconLibrary)
  for (const icon of icons) {
    getIconAssets(icon).forEach((asset) => assets.set(asset.id, asset))
  }
  return (iconId) => (iconId ? assets.get(iconId) : undefined)
}

function viewIds(config: FuxaConfig): GeneratedView[] {
  if (!Array.isArray(config.hmi.views)) {
    throw new Error('配置中的 View 清單格式無效，無法驗證匯出內容。')
  }
  const views: GeneratedView[] = []
  for (const view of config.hmi.views) {
    if (!isGeneratedView(view)) continue
    views.push(view)
  }
  return views
}

function reserveExistingIds(
  config: FuxaConfig,
  Parser: SvgParserConstructor,
): Set<string> {
  const ids = new Set<string>()
  for (const tagId of buildTagIndex(config).keys()) ids.add(tagId)
  for (const view of viewIds(config)) {
    if (isRecord(view.items)) {
      for (const id of Object.keys(view.items)) ids.add(id)
    }
    // FUXA 的空白 View 的 svgcontent 可以是空字串，沒有任何 SVG ID 需要保留
    if (!view.svgcontent.trim()) continue
    let doc: XMLDocument
    try {
      doc = parseSvg(view.svgcontent, Parser)
    } catch (error) {
      const detail = getErrorMessage(error)
      const label = typeof view.name === 'string' && view.name ? view.name : view.id
      throw new Error(`無法檢查 View「${label}」的 SVG ID，無法安全匯出修改：${detail}`, {
        cause: error,
      })
    }
    for (const node of Array.from(doc.getElementsByTagName('*'))) {
      const id = node.getAttribute('id')
      if (id) ids.add(id)
    }
  }
  return ids
}

function reserveModelIds(ids: Set<string>, models: readonly ExportViewModel[]): void {
  for (const model of models) {
    for (const component of [...model.components, ...(model.originalComponents ?? [])]) {
      if (component.shapeId) ids.add(component.shapeId)
      if (component.alarmShapeId) ids.add(component.alarmShapeId)
      for (const binding of component.multiStateBindings ?? []) {
        if (binding.shapeId) ids.add(binding.shapeId)
      }
      if (component.labelId) ids.add(component.labelId)
      for (const id of component.shapeInnerIds ?? []) {
        if (id) ids.add(id)
      }
    }
    for (const group of [
      model.floorTitles,
      model.floorTitleIds,
      model.floorFrames,
      model.floorFrameIds,
      model.floorFrameShapeIds,
    ]) {
      for (const value of Object.values(group)) {
        if (Array.isArray(value)) {
          for (const id of value) {
            if (id) ids.add(id)
          }
        } else if (value) {
          ids.add(value)
        }
      }
    }
  }
}

export function createFuxaConfigExportDependencies(
  config: FuxaConfig,
  runtime: FuxaConfigExportRuntime,
): PrepareFuxaConfigExportDependencies {
  const tags = buildTagIndex(config)
  const resolveIcon = iconResolver(config, runtime.iconLibrary)
  const floorPlans = getFloorPlanLibrary(config)
  const floorGroupFrame = runtime.floorGroupFrame ?? getFloorGroupFrameSettings(config)
  const createdIds = new Set<string>()
  let usedIds: Set<string> | undefined
  const allocateId: SvgIdAllocator = (prefix) => {
    usedIds ??= reserveExistingIds(config, runtime.Parser)
    const id = generateId(prefix, usedIds, runtime.crypto)
    createdIds.add(id)
    return id
  }

  return {
    buildingFloorsNeedSync(output) {
      return buildingFloorButtonsNeedSync(output, runtime.Parser)
    },
    syncBuildingFloors(output) {
      const changedViewIds = syncBuildingFloorButtons(
        output,
        runtime.Parser,
        runtime.serialize,
        allocateId,
      )
      if (buildingFloorButtonsNeedSync(output, runtime.Parser)) {
        throw new Error('樓層按鈕未正確寫入 View。')
      }
      return changedViewIds
    },
    alignFloorFrames(output) {
      alignFloorFramesToCanvas(
        output,
        runtime.Parser,
        runtime.serialize,
      )
      saveFloorFrameLayoutVersion(output)
    },
    applyView(view, model, models) {
      if (!isApplyModelView(view) || view.id !== model.viewId) {
        throw new Error(`View「${model.viewId}」缺少有效的 SVG 或 items，無法套用編輯模型。`)
      }
      usedIds ??= reserveExistingIds(config, runtime.Parser)
      reserveModelIds(usedIds, models)
      const floorPlanKey = model.floorPlan === true ? floorPlanKeyForView(view.name) : null
      applyModelToView(view, model, {
        Parser: runtime.Parser,
        serialize: runtime.serialize,
        allocateId,
        resolveIcon,
        tags,
        floorGroupFrame,
        floorPlanImage: floorPlanKey ? floorPlans[floorPlanKey] : undefined,
      })
    },
    validate(output, modifiedIds, models) {
      validateGeneratedViews(
        viewIds(output),
        modifiedIds,
        models,
        {
          Parser: runtime.Parser,
          tags,
          createdIds,
          iconLibrary: getIconLibrary(output),
        },
      )
    },
  }
}
