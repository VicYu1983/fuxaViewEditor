import type { FuxaConfig } from '../config/types'
import {
  getToolSettings,
  nextToolSettingsVersion,
  readToolSettingsForWrite,
  TOOL_SETTINGS_KEY,
} from '../config/toolSettings'
import { isRecord } from '../shared/isRecord'

export const VIEW_AUTO_STATE_MAPPING_KEY = 'viewAutoStateMapping'

export interface AutoViewStateGroup {
  state: string
  keywords: string[]
}

/**
 * 由 Tag 名稱結尾判斷狀態。關鍵字會依長度由長到短比對，
 * 因此「超高液位」會優先於「高水位」。
 */
export const DEFAULT_AUTO_STATE_MAPPING: readonly AutoViewStateGroup[] = Object.freeze([
  {
    state: '運轉',
    keywords: ['運轉', '運行', '啟動', '開啟'],
  },
  {
    state: '異常',
    keywords: ['過載', '故障', '異常', '告警', '警報', '火警', '洩漏', '入侵', '離線'],
  },
  {
    state: '停止',
    keywords: ['停止', '關閉'],
  },
  {
    state: '水位過高',
    keywords: ['超高液位', '超高水位', '高水位', '滿水'],
  },
  {
    state: '水位過低',
    keywords: ['低水位', '缺水'],
  },
])

const NORMALLY_CLOSED_PATTERN = /\s*(?:\(\s*NC\s*\)|\bNC\b)\s*$/i

function cloneStateMapping(
  groups: readonly AutoViewStateGroup[],
): AutoViewStateGroup[] {
  return groups.map((group) => ({ state: group.state, keywords: [...group.keywords] }))
}

function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const keywords = value
    .filter((keyword): keyword is string => typeof keyword === 'string')
    .map((keyword) => keyword.trim())
    .filter(Boolean)
  return [...new Set(keywords)]
}

export function normalizeAutoViewStateMapping(
  groups: readonly AutoViewStateGroup[],
): AutoViewStateGroup[] {
  return groups.map((group) => ({
    state: group.state.trim(),
    keywords: normalizeKeywords(group.keywords),
  }))
}

/** 回傳錯誤訊息；空陣列代表可套用。 */
export function validateAutoViewStateMapping(
  groups: readonly AutoViewStateGroup[],
): string[] {
  const errors: string[] = []
  const seenStates = new Set<string>()
  const keywordOwner = new Map<string, string>()

  groups.forEach((group, index) => {
    const row = `第 ${index + 1} 列`
    const state = group.state.trim()
    if (!state) {
      errors.push(`${row}：請輸入狀態名稱。`)
    } else if (seenStates.has(state.toLocaleLowerCase())) {
      errors.push(`${row}：狀態名稱「${state}」重複。`)
    } else {
      seenStates.add(state.toLocaleLowerCase())
    }

    const keywords = normalizeKeywords(group.keywords)
    if (keywords.length === 0) {
      errors.push(`${row}：請至少輸入一個關鍵字。`)
    }
    for (const keyword of keywords) {
      const normalized = keyword.toLocaleLowerCase()
      const owner = keywordOwner.get(normalized)
      if (owner !== undefined && owner !== state.toLocaleLowerCase()) {
        errors.push(`關鍵字「${keyword}」同時屬於「${owner}」與「${state}」。`)
      } else {
        keywordOwner.set(normalized, state.toLocaleLowerCase())
      }
    }
  })

  return errors
}

/**
 * 寬鬆讀取狀態關鍵字表；尚未保存時回傳預設值。
 * 明確保存空陣列則代表停用狀態判斷。
 */
export function readAutoViewStateMapping(config: unknown): AutoViewStateGroup[] {
  const mapping = getToolSettings(config)?.[VIEW_AUTO_STATE_MAPPING_KEY]
  if (mapping === undefined) return cloneStateMapping(DEFAULT_AUTO_STATE_MAPPING)
  if (!Array.isArray(mapping)) return []

  return mapping.flatMap((item) => {
    if (!isRecord(item) || typeof item.state !== 'string') return []
    const state = item.state.trim()
    if (!state) return []
    return [{ state, keywords: normalizeKeywords(item.keywords) }]
  })
}

export function saveAutoViewStateMapping(
  config: FuxaConfig,
  groups: readonly AutoViewStateGroup[],
): void {
  const errors = validateAutoViewStateMapping(groups)
  if (errors.length) throw new Error(errors[0])

  const { extra, toolSettings } = readToolSettingsForWrite(config, '保存一鍵配置狀態對應表')
  config.extra = extra
  extra[TOOL_SETTINGS_KEY] = {
    ...toolSettings,
    version: nextToolSettingsVersion(toolSettings),
    [VIEW_AUTO_STATE_MAPPING_KEY]: normalizeAutoViewStateMapping(groups),
  }
}

export interface TagStateMatch {
  /** 去掉狀態關鍵字與 (NC) 後的設備名稱。 */
  base: string
  state?: string
  normallyClosed: boolean
}

interface StateMatcher {
  state: string
  normalizedKeywords: string[]
}

function buildStateMatchers(groups: readonly AutoViewStateGroup[]): StateMatcher[] {
  return groups.flatMap((group) => {
    const state = group.state.trim()
    if (!state) return []
    const keywords = normalizeKeywords(group.keywords)
    if (keywords.length === 0) return []
    return [{
      state,
      normalizedKeywords: keywords
        .map((keyword) => keyword.toLocaleLowerCase())
        .sort((left, right) => right.length - left.length),
    }]
  })
}

/**
 * 由名稱結尾取出狀態；狀態比對不分大小寫。
 * `(NC)` 或結尾的 `NC` 會標記為 normallyClosed，不視為狀態。
 */
export function parseTagState(
  name: string,
  groups: readonly AutoViewStateGroup[],
): TagStateMatch {
  const withoutNc = name.replace(NORMALLY_CLOSED_PATTERN, '').trim()
  const normallyClosed = withoutNc.length !== name.trim().length
  const lower = withoutNc.toLocaleLowerCase()
  const matchers = buildStateMatchers(groups)

  let matchedState: string | undefined
  let base = withoutNc
  let matchedLength = 0
  for (const matcher of matchers) {
    for (const keyword of matcher.normalizedKeywords) {
      if (keyword.length > matchedLength && lower.endsWith(keyword)) {
        matchedState = matcher.state
        base = withoutNc.slice(0, withoutNc.length - keyword.length)
        matchedLength = keyword.length
      }
    }
  }

  return {
    base: base.replace(/[\s_\-/]+$/, '').trim(),
    ...(matchedState === undefined ? {} : { state: matchedState }),
    normallyClosed,
  }
}

export function isNormallyClosedName(name: string): boolean {
  return NORMALLY_CLOSED_PATTERN.test(name)
}
