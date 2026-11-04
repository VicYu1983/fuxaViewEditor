import type { IconLibraryEntry } from '../icons/iconLibrary'
import {
  parseTagState,
  type AutoViewStateGroup,
} from './autoViewStateMapping'

/** 將常見簡體／異體字統一，避免比對時因字形不同而漏配。 */
const VARIANT_CHARACTERS: Readonly<Record<string, string>> = Object.freeze({
  汙: '污',
  撒: '灑',
  烟: '煙',
  电: '電',
  机: '機',
  开: '開',
  关: '關',
  异: '異',
  启: '啟',
  动: '動',
  报: '報',
  门: '門',
  马: '馬',
  达: '達',
  风: '風',
  设: '設',
  备: '備',
  闭: '閉',
  侦: '偵',
  号: '號',
})

const IGNORED_CHARACTERS = /[\s_\-/／·,，.。:：、（）()[\]【】]/g

export function normalizeAutoViewText(value: string): string {
  return Array.from(value, (character) => VARIANT_CHARACTERS[character] ?? character)
    .join('')
    .replace(IGNORED_CHARACTERS, '')
    .toLocaleLowerCase()
}

export interface AutoViewIconMatch {
  icon: IconLibraryEntry
  /** 實際命中的圖示名稱（可能是去掉狀態字後的基底名稱）。 */
  matchedName: string
  /** 命中時使用的 Tag 名稱片段長度；數字越大優先。 */
  matchedLength: number
}

interface IconNameCandidate {
  normalized: string
  source: string
}

function iconNameCandidates(
  icon: IconLibraryEntry,
  stateMapping: readonly AutoViewStateGroup[],
): IconNameCandidate[] {
  const candidates: IconNameCandidate[] = []
  const seen = new Set<string>()
  const add = (name: string) => {
    const normalized = normalizeAutoViewText(name)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    candidates.push({ normalized, source: name })
  }
  add(icon.name)
  // 「偵烟器異常」這類圖示名稱本身含狀態字，也要能用「偵烟器」比對 Tag 基底。
  add(parseTagState(icon.name, stateMapping).base)
  return candidates
}

function matchIconByName(
  tagName: string,
  icons: readonly IconLibraryEntry[],
  stateMapping: readonly AutoViewStateGroup[],
): AutoViewIconMatch | undefined {
  const fullName = parseTagState(tagName, stateMapping)
  const tagCandidates = [
    normalizeAutoViewText(tagName),
    normalizeAutoViewText(fullName.base),
  ].filter(Boolean)

  let best: AutoViewIconMatch | undefined
  icons.forEach((icon) => {
    for (const candidate of iconNameCandidates(icon, stateMapping)) {
      if (!tagCandidates.some((tagName) => tagName.includes(candidate.normalized))) continue
      if (!best
          || candidate.normalized.length > best.matchedLength) {
        best = {
          icon,
          matchedName: candidate.source,
          matchedLength: candidate.normalized.length,
        }
      }
      break
    }
  })
  return best
}

function findIconByName(
  icons: readonly IconLibraryEntry[],
  name: string,
): IconLibraryEntry | undefined {
  const normalized = normalizeAutoViewText(name)
  return icons.find((icon) => normalizeAutoViewText(icon.name) === normalized)
}

function fallbackMatch(
  tagName: string,
  icons: readonly IconLibraryEntry[],
  stateMapping: readonly AutoViewStateGroup[],
): AutoViewIconMatch | undefined {
  const parsed = parseTagState(tagName, stateMapping)
  const normalized = normalizeAutoViewText(parsed.base || tagName)
  const full = normalizeAutoViewText(tagName)

  if (/水箱|水池|水塔/.test(normalized)
      && /水位|液位|滿水|缺水/.test(full)) {
    const icon = findIconByName(icons, '水箱水位')
    if (icon) return { icon, matchedName: '水箱水位', matchedLength: 0 }
  }

  if (normalized.includes('泵')) {
    const pumpNames = [
      { keyword: '消防', name: '消防泵' },
      { keyword: '灑水', name: '灑水泵' },
      { keyword: '污水', name: '污水泵' },
      { keyword: '雨水', name: '雨水泵' },
    ]
    for (const { keyword, name } of pumpNames) {
      if (!normalized.includes(keyword)) continue
      const icon = findIconByName(icons, name)
      if (icon) return { icon, matchedName: name, matchedLength: 0 }
    }
    const icon = findIconByName(icons, '泵浦')
    if (icon) return { icon, matchedName: '泵浦', matchedLength: 0 }
  }

  if (/火警|警報|告警|警鈴/.test(full)) {
    const icon = findIconByName(icons, '警報')
    if (icon) return { icon, matchedName: '警報', matchedLength: 0 }
  }

  return undefined
}

/**
 * 依 Tag 名稱自動配對圖示組。
 * 先比對圖示名稱（名稱越長優先），再套用水位、通用泵浦與警報後備規則。
 */
export function matchAutoViewIcon(
  tagName: string,
  icons: readonly IconLibraryEntry[],
  stateMapping: readonly AutoViewStateGroup[],
): AutoViewIconMatch | undefined {
  if (!tagName.trim() || icons.length === 0) return undefined
  return matchIconByName(tagName, icons, stateMapping)
    ?? fallbackMatch(tagName, icons, stateMapping)
}

export type AutoViewIconType = 'single' | 'pair' | 'multi'

export function getAutoViewIconType(icon: IconLibraryEntry): AutoViewIconType {
  if (icon.type === 'pair') return 'pair'
  if (icon.type === 'multi-state') return 'multi'
  return 'single'
}

export function getAutoViewIconTypeLabel(icon: IconLibraryEntry): string {
  const type = getAutoViewIconType(icon)
  return type === 'pair' ? '正常／告警' : type === 'multi' ? '多狀態' : '一般'
}
