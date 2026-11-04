import type { FuxaConfig } from '../config/types'
import {
  nextToolSettingsVersion,
  readToolSettingsForWrite,
  TOOL_SETTINGS_KEY,
  getToolSettings,
} from '../config/toolSettings'
import { isRecord } from '../shared/isRecord'
import { isAutoFilledTag, type IndexedTag } from '../tags/index'

export const VIEW_AUTO_MAPPING_KEY = 'viewAutoMapping'
export const UNCLASSIFIED_VIEW_NAME = '未分類'
export const AUTO_VIEW_EMPTY_VIEW_NAME = 'MainView'

export interface AutoViewGroup {
  name: string
  keywords: string[]
}

/**
 * 專案尚未保存分類表時使用的基礎版本。
 * 依列表順序決定優先順序；較特定或較重要的系統請放在前面
 * （例如「消防泵」同時含「消防」與「泵」，會歸入消防系統）。
 */
export const DEFAULT_AUTO_VIEW_MAPPING: readonly AutoViewGroup[] = Object.freeze([
  {
    name: '消防系統',
    keywords: ['消防', 'co2', '一氧化碳', '撒水', '泡沫', '火警', '滅火', '偵煙'],
  },
  {
    name: '給排水系統',
    keywords: ['泵', '污水', '汙水', '廢水', '水池', '水箱', '水位', '漏水'],
  },
  {
    name: '風機系統',
    keywords: ['風機', '排風', '進風', '導流', '空調', '風量'],
  },
  {
    name: '發電機系統',
    keywords: ['發電機', '发电机'],
  },
  {
    name: '電梯系統',
    keywords: ['電梯', '电梯', '昇降', '升降'],
  },
  {
    name: '門禁求救',
    keywords: ['安全門', '磁簧', '門禁', '紅外線', '红外线', '入侵', '求救'],
  },
  {
    name: '通訊狀態',
    keywords: ['connection status', '通訊', '通讯', '離線', '离线'],
  },
  {
    name: '照明系統',
    keywords: ['照明', '燈', '灯'],
  },
])

function cloneMapping(groups: readonly AutoViewGroup[]): AutoViewGroup[] {
  return groups.map((group) => ({ name: group.name, keywords: [...group.keywords] }))
}

export interface AutoViewClassificationGroup extends AutoViewGroup {
  tags: IndexedTag[]
}

export interface AutoViewAmbiguousTag {
  tag: IndexedTag
  groupNames: string[]
}

export interface AutoViewClassification {
  groups: AutoViewClassificationGroup[]
  unclassified: IndexedTag[]
  ambiguous: AutoViewAmbiguousTag[]
}

function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const keywords = value
    .filter((keyword): keyword is string => typeof keyword === 'string')
    .map((keyword) => keyword.trim())
    .filter(Boolean)
  return [...new Set(keywords)]
}

/**
 * 寬鬆讀取分類表；格式錯誤的項目會忽略，不影響其他設定。
 * 尚未保存過分類表時回傳基礎版本；若專案明確保存空陣列，則尊重使用者清空的結果。
 */
export function readAutoViewMapping(config: unknown): AutoViewGroup[] {
  const mapping = getToolSettings(config)?.[VIEW_AUTO_MAPPING_KEY]
  if (mapping === undefined) return cloneMapping(DEFAULT_AUTO_VIEW_MAPPING)
  if (!Array.isArray(mapping)) return []

  return mapping.flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== 'string') return []
    const name = item.name.trim()
    if (!name) return []
    return [{ name, keywords: normalizeKeywords(item.keywords) }]
  })
}

export function normalizeAutoViewMapping(groups: readonly AutoViewGroup[]): AutoViewGroup[] {
  return groups.map((group) => ({
    name: group.name.trim(),
    keywords: normalizeKeywords(group.keywords),
  }))
}

/** 回傳錯誤訊息；空陣列代表可套用。 */
export function validateAutoViewMapping(groups: readonly AutoViewGroup[]): string[] {
  const errors: string[] = []
  const seenNames = new Set<string>()

  groups.forEach((group, index) => {
    const row = `第 ${index + 1} 列`
    const name = group.name.trim()
    if (!name) {
      errors.push(`${row}：請輸入 View 名稱。`)
    } else if (name.toLocaleLowerCase() === UNCLASSIFIED_VIEW_NAME.toLocaleLowerCase()) {
      errors.push(`${row}：「${UNCLASSIFIED_VIEW_NAME}」是保留名稱，請改用其他名稱。`)
    } else if (seenNames.has(name.toLocaleLowerCase())) {
      errors.push(`${row}：View 名稱「${name}」重複。`)
    } else {
      seenNames.add(name.toLocaleLowerCase())
    }

    if (normalizeKeywords(group.keywords).length === 0) {
      errors.push(`${row}：請至少輸入一個關鍵字。`)
    }
  })

  return errors
}

export function saveAutoViewMapping(
  config: FuxaConfig,
  groups: readonly AutoViewGroup[],
): void {
  const errors = validateAutoViewMapping(groups)
  if (errors.length) throw new Error(errors[0])

  const { extra, toolSettings } = readToolSettingsForWrite(config, '保存一鍵配置分類表')
  config.extra = extra
  extra[TOOL_SETTINGS_KEY] = {
    ...toolSettings,
    version: nextToolSettingsVersion(toolSettings),
    [VIEW_AUTO_MAPPING_KEY]: normalizeAutoViewMapping(groups),
  }
}

/** 未勾選「包含自動補位 Tag」時，排除工具自動補位的點位。 */
export function filterAutoViewTags(
  tags: readonly IndexedTag[],
  includeAutoFilled: boolean,
): IndexedTag[] {
  return includeAutoFilled ? [...tags] : tags.filter((tag) => !isAutoFilledTag(tag))
}

/**
 * 依分類表順序比對 Tag 名稱；名稱包含任一關鍵字即命中。
 * 多組同時命中時歸入第一組，並記錄在 ambiguous 供預覽提示。
 */
export function classifyTagsForViews(
  tags: readonly IndexedTag[],
  groups: readonly AutoViewGroup[],
): AutoViewClassification {
  const normalizedGroups = groups.map((group) => {
    const keywords = normalizeKeywords(group.keywords)
    return {
      name: group.name.trim(),
      keywords,
      matchers: keywords.map((keyword) => keyword.toLocaleLowerCase()),
      tags: [] as IndexedTag[],
    }
  })
  const unclassified: IndexedTag[] = []
  const ambiguous: AutoViewAmbiguousTag[] = []

  for (const tag of tags) {
    const name = tag.name.trim().toLocaleLowerCase()
    const matches = name
      ? normalizedGroups.flatMap((group, index) => (
        group.matchers.some((keyword) => name.includes(keyword)) ? [index] : []
      ))
      : []

    if (matches.length === 0) {
      unclassified.push(tag)
      continue
    }

    normalizedGroups[matches[0]!]!.tags.push(tag)
    if (matches.length > 1) {
      ambiguous.push({
        tag,
        groupNames: matches.map((index) => normalizedGroups[index]!.name),
      })
    }
  }

  return {
    groups: normalizedGroups.map((group) => ({
      name: group.name,
      keywords: group.keywords,
      tags: group.tags,
    })),
    unclassified,
    ambiguous,
  }
}
