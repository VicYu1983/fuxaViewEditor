import type { FuxaConfig } from '../config/types'
import { getErrorMessage } from '../shared/getErrorMessage'
import { getFloorGroupFrameSettings } from '../layout/floorGroupFrame'
import type { FloorLayoutComponent, Bounds } from '../layout/floorLayout'
import { getViewGridSettings } from '../layout/gridSettings'
import { getViewFloorPlanSetting, getViewFloorPlanTagOffsets } from '../layout/floorPlanViews'
import { getFloorGroupArtifactIndex } from '../layout/floorGroupArtifacts'
import { getIconAssets, getIconLibrary } from '../icons/iconLibrary'
import type { MultiStateIconSet } from '../icons/iconLibrary'
import { readManaged } from '../svg/readManaged'
import type { SvgParserConstructor } from '../svg/parseSvg'
import type { ExportViewModel } from '../config/prepareFuxaConfigExport'
import { isRecord } from '../config/validateFuxaConfig'
import { buildTagIndex } from '../tags/index'
import {
  getStoredViewComponents,
  reconcileManagedComponents,
} from './viewComponents'
import type { StoredViewComponents } from './viewComponents'

export interface ExistingTagComponent extends FloorLayoutComponent {
  shapeId: string
  type: string
}

export interface ViewEditorModelsResult {
  models: Map<string, ExportViewModel>
  errors: Map<string, string>
  unsupported: Map<string, string[]>
  warnings: Map<string, string[]>
}

export type MeasureSvgBounds = (doc: XMLDocument, id: string) => Bounds

function reservedComponentIds(stored: StoredViewComponents | undefined): Set<string> {
  const ids = new Set<string>()
  for (const component of stored?.components ?? []) {
    for (const id of [
      component.shapeId,
      component.labelId,
      component.alarmShapeId,
      ...(component.multiStateBindings ?? []).map((binding) => binding.shapeId),
      ...component.shapeInnerIds,
    ]) {
      if (id) ids.add(id)
    }
  }
  return ids
}

function componentWarnings(pruned: readonly string[], invalidCount: number): string[] {
  const warnings: string[] = []
  if (pruned.length) {
    warnings.push(
      `下列元件對應的 Tag 已不存在，已自動移除，匯出時會一併從 View 清除：${pruned.join('、')}`,
    )
  }
  if (invalidCount > 0) {
    warnings.push(`有 ${invalidCount} 筆保存的元件定義格式無法辨識，已忽略。`)
  }
  return warnings
}

function hasSvgTransform(node: Element): boolean {
  let current: Element | null = node
  while (current && current.localName !== 'svg') {
    const transform = current.getAttribute('transform')
    const isToolPosition = current === node
      && current.getAttribute('data-fuxa-floor-layout') === 'floor-layout-v1'
      && /^translate\(-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?\)$/.test(transform ?? '')
    if (transform && !isToolPosition) return true
    current = current.parentElement
  }
  return false
}

function existingTagComponents(
  view: Record<string, unknown>,
  parsed: ReturnType<typeof readManaged>,
  measureBounds: MeasureSvgBounds,
  unsupported: string[],
): ExistingTagComponent[] {
  const components: ExistingTagComponent[] = []
  if (!parsed.doc) return components

  for (const candidate of parsed.movableTags) {
    try {
      const bounds = measureBounds(parsed.doc, candidate.id)
      components.push({
        key: `existing-${candidate.id}`,
        tagId: candidate.tagId,
        label: candidate.name,
        template: 'existing',
        shapeId: candidate.id,
        seq: Number.MAX_SAFE_INTEGER,
        type: candidate.type,
        managed: false,
        originalBounds: bounds,
        layoutWidth: bounds.width,
        layoutHeight: bounds.height,
        companions: [],
      })
    } catch (error) {
      const reason = getErrorMessage(error)
      unsupported.push(`${candidate.name}：${reason}`)
    }
  }

  const usedLabels = new Set<string>()
  const labels: Array<{ id: string; bounds: Bounds }> = []
  const items = isRecord(view.items) ? view.items : {}
  for (const [id, item] of Object.entries(items)) {
    if (!isRecord(item)
        || item.type !== 'svg-ext-shapes-text'
        || (isRecord(item.property) && typeof item.property.variableId === 'string')
        || item.name === 'fuxa_floor_section_title'
        || /^tc_\d+_label$/.test(typeof item.name === 'string' ? item.name : '')) continue
    const node = Array.from(parsed.doc.getElementsByTagName('*'))
      .find((element) => element.getAttribute('id') === id)
    if (!node || node.localName !== 'text' || hasSvgTransform(node)) continue
    try {
      labels.push({ id, bounds: measureBounds(parsed.doc, id) })
    } catch (error) {
      const reason = getErrorMessage(error)
      const name = typeof item.name === 'string' ? item.name : id
      unsupported.push(`${name}：無法量測既有文字位置（${reason}）`)
    }
  }

  for (const component of components) {
    const shape = component.originalBounds
    if (!shape) continue
    const centerX = shape.x + shape.width / 2
    const candidate = labels
      .filter(({ id, bounds }) => {
        if (usedLabels.has(id)) return false
        const centerDiff = Math.abs(bounds.x + bounds.width / 2 - centerX)
        const verticalGap = shape.y - (bounds.y + bounds.height)
        return centerDiff <= Math.max(2, Math.min(8, shape.width * 0.1))
          && verticalGap >= -2
          && verticalGap <= 80
      })
      .sort((left, right) => {
        const leftGap = shape.y - (left.bounds.y + left.bounds.height)
        const rightGap = shape.y - (right.bounds.y + right.bounds.height)
        return leftGap - rightGap
      })[0]
    if (!candidate) continue
    usedLabels.add(candidate.id)
    component.companions?.push(candidate)
  }
  return components
}

export function buildViewEditorModels(
  config: FuxaConfig,
  Parser: SvgParserConstructor,
  measureBounds: MeasureSvgBounds,
): ViewEditorModelsResult {
  const models = new Map<string, ExportViewModel>()
  const errors = new Map<string, string>()
  const unsupported = new Map<string, string[]>()
  const warnings = new Map<string, string[]>()
  const duplicates = new Set<string>()
  const tagIds = new Set(buildTagIndex(config).keys())
  const tagExists = (tagId: string) => tagIds.has(tagId)
  const iconLibrary = getIconLibrary(config)
  const multiStateIcons = iconLibrary.filter(
    (icon): icon is MultiStateIconSet => icon.type === 'multi-state',
  )
  const iconAssetIds = new Map(
    iconLibrary.flatMap((icon) => getIconAssets(icon).map((asset) => [
      asset.dataUrl,
      asset.id,
    ] as const)),
  )
  const views = config.hmi.views

  for (const view of views) {
    if (!isRecord(view)) continue
    if (typeof view.id !== 'string' || !view.id) {
      errors.set('', '此 View 缺少有效 ID，為避免修改錯誤的 View，已設為唯讀。')
      continue
    }
    if (duplicates.has(view.id)) {
      errors.set(view.id, `配置中 View ID「${view.id}」重複，為避免匯出錯誤，此 View 設為唯讀。`)
      models.delete(view.id)
      continue
    }
    if (models.has(view.id) || errors.has(view.id)) {
      duplicates.add(view.id)
      models.delete(view.id)
      errors.set(view.id, `配置中 View ID「${view.id}」重複，為避免匯出錯誤，此 View 設為唯讀。`)
      continue
    }

    const stored = getStoredViewComponents(config, view.id)
    const parsed = readManaged(
      view,
      Parser,
      getFloorGroupArtifactIndex(config, view.id),
      iconAssetIds,
      multiStateIcons,
      reservedComponentIds(stored),
    )
    if (parsed.error) {
      errors.set(view.id, parsed.error)
      continue
    }

    const reconciled = reconcileManagedComponents(stored, parsed.records, tagExists)
    const viewWarnings = componentWarnings(reconciled.pruned, stored?.invalidCount ?? 0)
    if (viewWarnings.length) warnings.set(view.id, viewWarnings)

    const unsupportedItems = parsed.unmanaged.map((item) => `${item.name}：${item.reason}`)
    const existingComponents = existingTagComponents(view, parsed, measureBounds, unsupportedItems)
    const components: ExportViewModel['components'] = [
      ...reconciled.components,
      ...existingComponents,
    ]
    const titles = { ...(parsed.floorTitles ?? {}) }
    const titleIds = structuredClone(parsed.floorTitleIds ?? {})
    const frames = { ...(parsed.floorFrames ?? {}) }
    const frameIds = structuredClone(parsed.floorFrameIds ?? {})
    const model: ExportViewModel = {
      viewId: view.id,
      components,
      originalComponents: structuredClone([...reconciled.original, ...existingComponents]),
      componentsNeedRebuild: reconciled.needsRebuild,
      floorGroupsNeedRebuild: (parsed.unregisteredFloorItemIds?.length ?? 0) > 0,
      grid: getViewGridSettings(config, view.id),
      floorGroupFrame: getFloorGroupFrameSettings(config),
      floorPlan: getViewFloorPlanSetting(config, view.id),
      floorPlanTagOffsets: getViewFloorPlanTagOffsets(config, view.id),
      floorTitles: titles,
      floorTitleIds: titleIds,
      floorFrames: frames,
      floorFrameIds: frameIds,
      floorFrameShapeIds: { ...(parsed.floorFrameShapeIds ?? {}) },
    }
    model.originalFloorTitleIds = structuredClone(titleIds)
    model.originalFloorFrameIds = structuredClone(frameIds)
    models.set(view.id, model)
    if (unsupportedItems.length) unsupported.set(view.id, unsupportedItems)
  }

  return { models, errors, unsupported, warnings }
}
