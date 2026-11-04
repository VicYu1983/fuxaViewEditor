import type { IconLibraryEntry } from '../icons/iconLibrary'
import { isCoilTag, type IndexedTag } from '../tags/index'
import {
  getAutoViewIconType,
  matchAutoViewIcon,
  normalizeAutoViewText,
} from './autoViewIconMatching'
import {
  parseTagState,
  type AutoViewStateGroup,
} from './autoViewStateMapping'

export const AUTO_VIEW_ICON_AUTO = 'auto'
export const AUTO_VIEW_ICON_NONE = 'none'
export const AUTO_VIEW_ICON_ENTRY_PREFIX = 'entry:'

export type AutoViewIconOverrides = Readonly<Record<string, string>>

export type AutoViewPlanKind = 'multi' | 'pair' | 'icon' | 'switch' | 'rect'

export interface AutoViewMultiStatePlanBinding {
  stateKey: string
  stateName: string
  iconId: string
  tagId: string
}

export interface AutoViewPlannedComponent {
  kind: AutoViewPlanKind
  label: string
  tagIds: string[]
  tagNames: string[]
  iconEntry?: IconLibraryEntry
  iconId?: string
  normalIconId?: string
  alarmIconId?: string
  invertIconState?: boolean
  multiIconSetId?: string
  multiBindings?: AutoViewMultiStatePlanBinding[]
  warnings: string[]
}

export interface AutoViewDevicePlan {
  /** 穩定的裝置鍵；同時用作手動改選圖示的索引。 */
  key: string
  viewKey: string
  base: string
  tags: IndexedTag[]
  /** 自動配對到的圖示 ID；未配對時為空字串。 */
  autoIconId: string
  autoIconName?: string
  /** 'auto'、'none' 或 `entry:<iconId>`。 */
  overrideValue: string
  /** 實際採用的圖示 ID；未採用時為空字串。 */
  iconId: string
  components: AutoViewPlannedComponent[]
  warnings: string[]
}

export interface AutoViewPlanSummary {
  deviceCount: number
  matchedDeviceCount: number
  warningDeviceCount: number
  multiComponentCount: number
  pairComponentCount: number
  singleIconComponentCount: number
  switchComponentCount: number
  rectComponentCount: number
}

export function autoViewDeviceKey(viewKey: string, base: string): string {
  return `${viewKey}::${normalizeAutoViewText(base) || base}`
}

function isBooleanTag(tag: IndexedTag): boolean {
  return ['bool', 'boolean'].includes(tag.type.toLocaleLowerCase())
}

export function canCreateAutoViewSwitch(
  tag: IndexedTag,
  coilSwitchEnabled: boolean,
): boolean {
  return coilSwitchEnabled && isBooleanTag(tag) && isCoilTag(tag)
}

function fallbackComponent(
  tag: IndexedTag,
  coilSwitchEnabled: boolean,
): AutoViewPlannedComponent {
  const useSwitch = canCreateAutoViewSwitch(tag, coilSwitchEnabled)
  return {
    kind: useSwitch ? 'switch' : 'rect',
    label: tag.name,
    tagIds: [tag.id],
    tagNames: [tag.name],
    warnings: [],
  }
}

function pairComponent(
  tag: IndexedTag,
  icon: IconLibraryEntry & { type: 'pair' },
  invertIconState: boolean,
): AutoViewPlannedComponent {
  return {
    kind: 'pair',
    label: tag.name,
    tagIds: [tag.id],
    tagNames: [tag.name],
    iconEntry: icon,
    normalIconId: icon.normal.id,
    alarmIconId: icon.alarm.id,
    ...(invertIconState ? { invertIconState: true } : {}),
    warnings: [],
  }
}

function singleIconComponent(
  tag: IndexedTag,
  icon: IconLibraryEntry,
  iconId: string,
): AutoViewPlannedComponent {
  return {
    kind: 'icon',
    label: tag.name,
    tagIds: [tag.id],
    tagNames: [tag.name],
    iconEntry: icon,
    iconId,
    warnings: [],
  }
}

interface DeviceEntry {
  tag: IndexedTag
  state?: string
  normallyClosed: boolean
  base: string
}

function shouldInvertPair(entry: DeviceEntry): boolean {
  return entry.normallyClosed
    || entry.state === '正常'
    || entry.state === '停止'
}

function multiComponent(
  base: string,
  icon: IconLibraryEntry & { type: 'multi-state' },
  bindings: AutoViewMultiStatePlanBinding[],
): AutoViewPlannedComponent {
  return {
    kind: 'multi',
    label: base,
    tagIds: bindings.map((binding) => binding.tagId),
    tagNames: [],
    iconEntry: icon,
    normalIconId: icon.normal.id,
    multiIconSetId: icon.id,
    multiBindings: bindings,
    warnings: [],
  }
}

function buildMultiBindings(
  icon: IconLibraryEntry & { type: 'multi-state' },
  entries: readonly DeviceEntry[],
): { bindings: AutoViewMultiStatePlanBinding[]; missing: string[]; usedTagIds: Set<string> } {
  const bindings: AutoViewMultiStatePlanBinding[] = []
  const missing: string[] = []
  const usedTagIds = new Set<string>()
  for (const state of icon.states) {
    const normalizedState = normalizeAutoViewText(state.name)
    const entry = entries.find((candidate) => (
      candidate.state !== undefined
      && normalizeAutoViewText(candidate.state) === normalizedState
    ))
    if (!entry) {
      missing.push(state.name)
      continue
    }
    usedTagIds.add(entry.tag.id)
    bindings.push({
      stateKey: state.key,
      stateName: state.name,
      iconId: state.asset.id,
      tagId: entry.tag.id,
    })
  }
  return { bindings, missing, usedTagIds }
}

interface BuildPlansOptions {
  tags: readonly IndexedTag[]
  viewKey: string
  stateMapping: readonly AutoViewStateGroup[]
  icons: readonly IconLibraryEntry[]
  coilSwitchEnabled: boolean
  iconOverrides?: AutoViewIconOverrides
}

export function buildAutoViewComponentPlans({
  tags,
  viewKey,
  stateMapping,
  icons,
  coilSwitchEnabled,
  iconOverrides = {},
}: BuildPlansOptions): AutoViewDevicePlan[] {
  const groups = new Map<string, { base: string; entries: DeviceEntry[] }>()

  for (const tag of tags) {
    const parsed = parseTagState(tag.name, stateMapping)
    const base = parsed.base || tag.name
    const groupKey = normalizeAutoViewText(base) || tag.id
    const group = groups.get(groupKey) ?? { base, entries: [] }
    group.entries.push({
      tag,
      ...(parsed.state === undefined ? {} : { state: parsed.state }),
      normallyClosed: parsed.normallyClosed,
      base,
    })
    groups.set(groupKey, group)
  }

  return Array.from(groups.values(), (group) => {
    const key = autoViewDeviceKey(viewKey, group.base)
    const autoMatch = matchAutoViewIcon(group.base, icons, stateMapping)
      ?? group.entries
        .map((entry) => matchAutoViewIcon(entry.tag.name, icons, stateMapping))
        .find((match) => match !== undefined)
    const overrideValue = iconOverrides[key] ?? AUTO_VIEW_ICON_AUTO
    const selectedIcon = overrideValue === AUTO_VIEW_ICON_AUTO
      ? autoMatch?.icon
      : overrideValue === AUTO_VIEW_ICON_NONE
        ? undefined
        : overrideValue.startsWith(AUTO_VIEW_ICON_ENTRY_PREFIX)
          ? icons.find((icon) => (
            icon.id === overrideValue.slice(AUTO_VIEW_ICON_ENTRY_PREFIX.length)
          ))
          : undefined

    const components: AutoViewPlannedComponent[] = []
    const warnings: string[] = []
    if (overrideValue !== AUTO_VIEW_ICON_AUTO
        && overrideValue !== AUTO_VIEW_ICON_NONE
        && !selectedIcon) {
      warnings.push('手動選擇的圖示組已不存在，改用自動判斷。')
    }

    const stateEntries = group.entries.filter((entry) => entry.state !== undefined)
    const plainEntries = group.entries.filter((entry) => entry.state === undefined)
    const iconType = selectedIcon ? getAutoViewIconType(selectedIcon) : undefined

    if (group.entries.length === 1) {
      const entry = group.entries[0]!
      let planned = false
      if (selectedIcon && iconType === 'pair') {
        components.push(pairComponent(
          entry.tag,
          selectedIcon as IconLibraryEntry & { type: 'pair' },
          shouldInvertPair(entry),
        ))
        planned = true
      } else if (selectedIcon && iconType === 'single') {
        components.push(singleIconComponent(entry.tag, selectedIcon, selectedIcon.id))
        planned = true
      } else if (selectedIcon && iconType === 'multi') {
        const multiIcon = selectedIcon as IconLibraryEntry & { type: 'multi-state' }
        const { bindings, missing } = buildMultiBindings(multiIcon, [entry])
        if (missing.length === 0 && bindings.length === multiIcon.states.length) {
          components.push(multiComponent(group.base, multiIcon, bindings))
          planned = true
        } else {
          warnings.push(`缺少狀態 Tag：${missing.join('、')}，改用開關／矩形。`)
        }
      } else if (!selectedIcon && entry.state !== undefined) {
        warnings.push('找不到對應的圖示組，改用開關／矩形。')
      }

      if (!planned) components.push(fallbackComponent(entry.tag, coilSwitchEnabled))
    } else if (stateEntries.length > 0 && iconType === 'multi') {
      const multiIcon = selectedIcon as IconLibraryEntry & { type: 'multi-state' }
      const { bindings, missing, usedTagIds } = buildMultiBindings(multiIcon, stateEntries)
      if (missing.length === 0 && bindings.length === multiIcon.states.length) {
        components.push(multiComponent(group.base, multiIcon, bindings))
        for (const entry of stateEntries) {
          if (usedTagIds.has(entry.tag.id)) continue
          warnings.push(`狀態「${entry.state}」不在圖示組「${multiIcon.name}」中，另建元件。`)
          components.push(fallbackComponent(entry.tag, coilSwitchEnabled))
        }
      } else {
        warnings.push(`缺少狀態 Tag：${missing.join('、')}，改用開關／矩形。`)
        for (const entry of stateEntries) {
          components.push(fallbackComponent(entry.tag, coilSwitchEnabled))
        }
      }
      for (const entry of plainEntries) {
        components.push(fallbackComponent(entry.tag, coilSwitchEnabled))
      }
    } else if (stateEntries.length > 0) {
      if (selectedIcon) {
        warnings.push(
          `圖示組「${selectedIcon.name}」無法對應多個狀態 Tag，改用開關／矩形。`,
        )
      } else {
        warnings.push('找不到對應的圖示組，改用開關／矩形。')
      }
      for (const entry of stateEntries) {
        components.push(fallbackComponent(entry.tag, coilSwitchEnabled))
      }
      for (const entry of plainEntries) {
        components.push(fallbackComponent(entry.tag, coilSwitchEnabled))
      }
    } else {
      warnings.push('多個 Tag 但沒有可辨識的狀態，未建立多狀態元件。')
      for (const entry of group.entries) {
        components.push(fallbackComponent(entry.tag, coilSwitchEnabled))
      }
    }

    return {
      key,
      viewKey,
      base: group.base,
      tags: group.entries.map((entry) => entry.tag),
      autoIconId: autoMatch?.icon.id ?? '',
      ...(autoMatch?.icon.name ? { autoIconName: autoMatch.icon.name } : {}),
      overrideValue,
      iconId: selectedIcon?.id ?? '',
      components,
      warnings,
    } satisfies AutoViewDevicePlan
  })
}

export function summarizeAutoViewPlans(
  plans: readonly AutoViewDevicePlan[],
): AutoViewPlanSummary {
  const summary: AutoViewPlanSummary = {
    deviceCount: plans.length,
    matchedDeviceCount: plans.filter((plan) => plan.iconId).length,
    warningDeviceCount: plans.filter((plan) => plan.warnings.length > 0).length,
    multiComponentCount: 0,
    pairComponentCount: 0,
    singleIconComponentCount: 0,
    switchComponentCount: 0,
    rectComponentCount: 0,
  }
  for (const plan of plans) {
    for (const component of plan.components) {
      if (component.kind === 'multi') summary.multiComponentCount += 1
      else if (component.kind === 'pair') summary.pairComponentCount += 1
      else if (component.kind === 'icon') summary.singleIconComponentCount += 1
      else if (component.kind === 'switch') summary.switchComponentCount += 1
      else summary.rectComponentCount += 1
    }
  }
  return summary
}

export function describeAutoViewPlannedComponent(
  component: AutoViewPlannedComponent,
): string {
  switch (component.kind) {
    case 'multi':
      return '多狀態'
    case 'pair':
      return '正常／告警'
    case 'icon':
      return '一般圖示'
    case 'switch':
      return 'Switch'
    default:
      return '矩形'
  }
}
