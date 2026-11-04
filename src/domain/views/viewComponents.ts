import type { FuxaConfig } from '../config/types'
import { isRecord } from '../shared/isRecord'
import {
  TOOL_SETTINGS_KEY,
  getToolSettings,
  readToolSettingsForWrite,
} from '../config/toolSettings'
import type { ManagedComponentRecord, MultiStateBinding } from '../svg/readManagedComponents'

// Tag 元件定義的保存與還原。設計見 docs/EXTRA_SOURCE_OF_TRUTH.md 第 7 節 Phase 4。
// extra.fuxaSetting.viewComponents[viewId] 是受管 Tag 元件的唯一來源；SVG 只在舊檔（沒有此鍵）時用來還原。

const VIEW_COMPONENTS_KEY = 'viewComponents'
const TEMPLATES = new Set<ManagedComponentRecord['template']>([
  'icon-multi',
  'icon-pair',
  'icon',
  'cylinder',
  'switch',
  'rect',
])

export type StoredViewComponent = Omit<ManagedComponentRecord, 'key' | 'managed'>

export interface StoredViewComponents {
  components: StoredViewComponent[]
  /** 格式無法辨識而被丟棄的筆數。 */
  invalidCount: number
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function normalizeBinding(value: unknown): MultiStateBinding | undefined {
  if (!isRecord(value)
      || !isNonEmptyString(value.stateKey)
      || typeof value.iconId !== 'string'
      || typeof value.tagId !== 'string'
      || !isNonEmptyString(value.shapeId)) return undefined
  return {
    stateKey: value.stateKey,
    iconId: value.iconId,
    tagId: value.tagId,
    shapeId: value.shapeId,
  }
}

export function normalizeStoredComponent(value: unknown): StoredViewComponent | undefined {
  if (!isRecord(value)) return undefined
  const { seq, tagId, label, template, palette, shapeId, labelId } = value
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0
      || typeof tagId !== 'string'
      || typeof label !== 'string'
      || typeof template !== 'string'
      || !TEMPLATES.has(template as ManagedComponentRecord['template'])
      || (palette !== 'normal' && palette !== 'alarm')
      || !isNonEmptyString(shapeId)
      || !isNonEmptyString(labelId)) return undefined

  const component: StoredViewComponent = {
    seq,
    tagId,
    label,
    template: template as ManagedComponentRecord['template'],
    palette,
    shapeId,
    labelId,
    shapeInnerIds: Array.isArray(value.shapeInnerIds)
      ? value.shapeInnerIds.map((id) => (isNonEmptyString(id) ? id : null))
      : [],
  }
  for (const key of [
    'iconId', 'normalIconId', 'alarmIconId', 'alarmShapeId', 'multiIconSetId',
  ] as const) {
    const field = value[key]
    if (isNonEmptyString(field)) component[key] = field
  }
  if (typeof value.invertIconState === 'boolean') {
    component.invertIconState = value.invertIconState
  }
  if (value.multiStateBindings !== undefined) {
    if (!Array.isArray(value.multiStateBindings)) return undefined
    const bindings = value.multiStateBindings.map(normalizeBinding)
    if (bindings.some((binding) => binding === undefined)) return undefined
    component.multiStateBindings = bindings as MultiStateBinding[]
  }
  return component
}

export function toStoredComponent(component: unknown): StoredViewComponent {
  const stored = normalizeStoredComponent(component)
  if (!stored) {
    const label = isRecord(component) ? String(component.label || component.shapeId || '') : ''
    throw new Error(`Tag 元件「${label || '未命名'}」的定義不完整，無法保存。`)
  }
  return stored
}

/** 回傳該 View 保存的受管元件；沒有保存（舊檔）時回傳 undefined。 */
export function getStoredViewComponents(
  config: FuxaConfig,
  viewId: string,
): StoredViewComponents | undefined {
  const all = getToolSettings(config)?.[VIEW_COMPONENTS_KEY]
  const entries = isRecord(all) ? all[viewId] : undefined
  if (!Array.isArray(entries)) return undefined

  const components: StoredViewComponent[] = []
  const seen = new Set<string>()
  let invalidCount = 0
  for (const entry of entries) {
    const component = normalizeStoredComponent(entry)
    if (!component || seen.has(component.shapeId)) {
      invalidCount += 1
      continue
    }
    seen.add(component.shapeId)
    components.push(component)
  }
  return { components, invalidCount }
}

export function saveViewComponents(
  config: FuxaConfig,
  viewIds: readonly string[],
  componentsByView: ReadonlyMap<string, readonly unknown[]>,
): void {
  const { extra, toolSettings } = readToolSettingsForWrite(config, '安全保存 Tag 元件定義')
  config.extra = extra

  const activeViewIds = new Set(viewIds)
  const current = toolSettings[VIEW_COMPONENTS_KEY]
  const saved: Record<string, unknown> = {}
  if (isRecord(current)) {
    for (const [viewId, entries] of Object.entries(current)) {
      if (activeViewIds.has(viewId)) saved[viewId] = entries
    }
  }
  for (const [viewId, components] of componentsByView) {
    if (!activeViewIds.has(viewId)) continue
    const entries = components
      .filter((component) => !isRecord(component) || component.managed !== false)
      .map(toStoredComponent)
    if (entries.length > 0) saved[viewId] = entries
    else delete saved[viewId]
  }

  const updated = { ...toolSettings }
  if (Object.keys(saved).length > 0) updated[VIEW_COMPONENTS_KEY] = saved
  else delete updated[VIEW_COMPONENTS_KEY]
  extra[TOOL_SETTINGS_KEY] = updated
}

function referencedTagIds(component: StoredViewComponent): string[] {
  return [
    component.tagId,
    ...(component.multiStateBindings ?? []).map((binding) => binding.tagId),
  ].filter(Boolean)
}

function bindingSignature(bindings: readonly MultiStateBinding[] | undefined): string {
  return JSON.stringify(
    [...(bindings ?? [])]
      .map(({ stateKey, iconId, tagId, shapeId }) => [stateKey, iconId, tagId, shapeId])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
  )
}

// 比對 SVG 還原結果與保存的定義；undefined、空字串與 false 視為相同，避免誤判為需要重建。
function componentDiffers(stored: StoredViewComponent, derived: ManagedComponentRecord): boolean {
  const same = (left: unknown, right: unknown) => (left || '') === (right || '')
  return stored.tagId !== derived.tagId
    || stored.label !== derived.label
    || stored.template !== derived.template
    || stored.palette !== derived.palette
    || stored.labelId !== derived.labelId
    || !same(stored.iconId, derived.iconId)
    || !same(stored.normalIconId, derived.normalIconId)
    || !same(stored.alarmIconId, derived.alarmIconId)
    || !same(stored.alarmShapeId, derived.alarmShapeId)
    || !same(stored.multiIconSetId, derived.multiIconSetId)
    || !same(stored.invertIconState, derived.invertIconState)
    || bindingSignature(stored.multiStateBindings) !== bindingSignature(derived.multiStateBindings)
}

export interface ReconciledComponents {
  /** 編輯器要顯示與匯出的受管元件。 */
  components: ManagedComponentRecord[]
  /** 匯出時需要從 SVG 清除的元件（含已移除者），供 removeManagedFromView 使用。 */
  original: ManagedComponentRecord[]
  /** SVG 與保存的定義不一致，匯出時需要重新套用此 View。 */
  needsRebuild: boolean
  /** 因對應的 Tag 已不存在而移除的元件名稱。 */
  pruned: string[]
}

/**
 * 以保存的定義為主，與從 SVG 還原的結果合併：
 * - 保存的元件一律保留（SVG 找不到時匯出會重建），Tag 已不存在者移除並回報。
 * - SVG 還原到、但沒有保存定義的元件（舊檔或工具外新增）照舊保留。
 * - 沒有保存定義（舊檔）時完全沿用 SVG 還原結果。
 */
export function reconcileManagedComponents(
  stored: StoredViewComponents | undefined,
  derived: readonly ManagedComponentRecord[],
  tagExists: (tagId: string) => boolean,
): ReconciledComponents {
  if (!stored) {
    return {
      components: [...derived],
      original: [...derived],
      needsRebuild: false,
      pruned: [],
    }
  }

  const derivedByShape = new Map(derived.map((record) => [record.shapeId, record]))
  const components: ManagedComponentRecord[] = []
  const original: ManagedComponentRecord[] = []
  const pruned: string[] = []
  let needsRebuild = stored.invalidCount > 0
  const matched = new Set<string>()

  for (const definition of stored.components) {
    const record: ManagedComponentRecord = {
      ...structuredClone(definition),
      key: `loaded-${definition.seq}`,
      managed: true,
    }
    const match = derivedByShape.get(definition.shapeId)
    if (match) {
      matched.add(match.shapeId)
      original.push(match)
    }
    original.push(record)

    if (!referencedTagIds(definition).every(tagExists)) {
      pruned.push(definition.label || definition.shapeId)
      needsRebuild = true
      continue
    }
    if (!match || componentDiffers(definition, match)) needsRebuild = true
    components.push(record)
  }

  for (const record of derived) {
    if (matched.has(record.shapeId)) continue
    components.push(record)
    original.push(record)
  }

  return { components, original, needsRebuild, pruned }
}
