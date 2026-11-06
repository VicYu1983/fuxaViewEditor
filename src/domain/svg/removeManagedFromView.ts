// Here, floor means a Tag group within one View, not a cross-View building floor.
import { isRecord } from '../config/validateFuxaConfig'
import { FLOOR_PLAN_ATTRIBUTE, FLOOR_PLAN_ID } from './buildFloorPlanNode'
import { labelBackgroundId } from './buildComponentNodes'
import { findSvgElementById } from './parseSvg'

const FLOOR_ARTIFACT_NAMES = new Set([
  'fuxa_floor_section_title',
  'fuxa_floor_section_frame',
  'fuxa_building_floor_button',
])

function hasImageDataHref(node: Element): boolean {
  const href = node.getAttribute('xlink:href') ?? node.getAttribute('href')
  return href?.startsWith('data:image/') === true
}

// 平面圖節點可能因 FUXA 往返遺失 data-* 標記，平面圖 View 中改以 id 或「未命名、位於 0,0 的 base64 圖片」辨識，避免重複新增。
function isFloorPlanNode(node: Element, floorPlanView: boolean): boolean {
  if (node.getAttribute(FLOOR_PLAN_ATTRIBUTE) !== null) return true
  if (node.getAttribute('id') === FLOOR_PLAN_ID) return true
  return floorPlanView
    && node.localName === 'image'
    && node.getAttribute('data-name') === null
    && node.getAttribute('x') === '0'
    && node.getAttribute('y') === '0'
    && hasImageDataHref(node)
}

interface ManagedComponentRef {
  managed?: boolean
  shapeId?: unknown
  alarmShapeId?: unknown
  labelId?: unknown
  multiStateBindings?: unknown
}

export interface ManagedSvgModelRef {
  floorPlan?: boolean
  components?: readonly ManagedComponentRef[]
  originalComponents?: readonly ManagedComponentRef[]
  floorTitles?: Record<string, unknown>
  floorFrames?: Record<string, unknown>
  originalFloorTitleIds?: Record<string, unknown>
  floorTitleIds?: Record<string, unknown>
  originalFloorFrameIds?: Record<string, unknown>
  floorFrameIds?: Record<string, unknown>
}

export interface ManagedSvgViewRef {
  items: Record<string, unknown>
}

function addStringValues(target: Set<string>, values: unknown): void {
  if (!Array.isArray(values)) return
  for (const value of values) {
    if (typeof value === 'string' && value) target.add(value)
  }
}

function addRecordValues(target: Set<string>, record: unknown): void {
  if (!isRecord(record)) return
  for (const value of Object.values(record)) {
    if (typeof value === 'string' && value) target.add(value)
    else addStringValues(target, value)
  }
}

function addComponentIds(target: Set<string>, components: unknown): void {
  if (!Array.isArray(components)) return
  for (const component of components) {
    if (!isRecord(component) || component.managed === false) continue
    for (const key of ['shapeId', 'alarmShapeId', 'labelId'] as const) {
      const id = component[key]
      if (typeof id === 'string' && id) target.add(id)
    }
    // 標籤底框的 id 由 labelId 推導，重新匯出時要一併移除，否則會殘留堆疊
    if (typeof component.labelId === 'string' && component.labelId) {
      target.add(labelBackgroundId(component.labelId))
    }
    if (Array.isArray(component.multiStateBindings)) {
      for (const binding of component.multiStateBindings) {
        if (!isRecord(binding) || typeof binding.shapeId !== 'string' || !binding.shapeId) continue
        target.add(binding.shapeId)
      }
    }
  }
}

function managedIds(model: ManagedSvgModelRef, view: ManagedSvgViewRef): Set<string> {
  const ids = new Set<string>()
  addComponentIds(ids, model.originalComponents)
  addComponentIds(ids, model.components)
  addRecordValues(ids, model.floorTitles)
  addRecordValues(ids, model.floorFrames)
  addRecordValues(ids, model.originalFloorTitleIds)
  addRecordValues(ids, model.floorTitleIds)
  addRecordValues(ids, model.originalFloorFrameIds)
  addRecordValues(ids, model.floorFrameIds)

  for (const [id, item] of Object.entries(view.items)) {
    if (isRecord(item) && FLOOR_ARTIFACT_NAMES.has(String(item.name))) ids.add(id)
  }
  return ids
}

export function removeManagedFromView(
  view: ManagedSvgViewRef,
  model: ManagedSvgModelRef,
  doc: XMLDocument,
): void {
  const ids = managedIds(model, view)
  const allNodes = Array.from(doc.getElementsByTagName('*'))

  for (const node of allNodes) {
    if (!FLOOR_ARTIFACT_NAMES.has(node.getAttribute('data-name') ?? '')
        && !isFloorPlanNode(node, model.floorPlan === true)) continue
    node.parentNode?.removeChild(node)
  }

  for (const id of ids) {
    const node = findSvgElementById(doc, id)
    const pairWrapper = node?.closest('[data-fuxa-icon-pair-wrapper]')
    const removeNode = pairWrapper ?? node
    removeNode?.parentNode?.removeChild(removeNode)
    delete view.items[id]
  }
}
