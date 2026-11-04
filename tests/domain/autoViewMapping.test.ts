import { describe, expect, it } from 'vitest'
import type { FuxaConfig } from '../../src/domain/config/types'
import {
  AUTO_FILLED_TAG_DESCRIPTION,
  type IndexedTag,
} from '../../src/domain/tags/index'
import {
  classifyTagsForViews,
  DEFAULT_AUTO_VIEW_MAPPING,
  filterAutoViewTags,
  normalizeAutoViewMapping,
  readAutoViewMapping,
  saveAutoViewMapping,
  UNCLASSIFIED_VIEW_NAME,
  validateAutoViewMapping,
  VIEW_AUTO_MAPPING_KEY,
} from '../../src/domain/views/autoViewMapping'

function makeTag(id: string, name: string, description?: string): IndexedTag {
  return {
    id,
    name,
    type: 'Bool',
    memaddress: '100',
    deviceId: 'dev-1',
    deviceName: 'DevA',
    floor: '',
    record: description ? { description } : {},
  }
}

function makeConfig(extra?: unknown): FuxaConfig {
  return {
    devices: {},
    hmi: { views: [] },
    ...(extra === undefined ? {} : { extra }),
  }
}

describe('readAutoViewMapping', () => {
  it('returns the default mapping when the project has no saved mapping', () => {
    expect(readAutoViewMapping(makeConfig())).toEqual(DEFAULT_AUTO_VIEW_MAPPING)
    expect(readAutoViewMapping(makeConfig({ fuxaSetting: {} })))
      .toEqual(DEFAULT_AUTO_VIEW_MAPPING)
    expect(readAutoViewMapping(makeConfig({ fuxaSetting: { viewAutoMapping: 'bad' } })))
      .toEqual([])
  })

  it('returns independent copies of the default mapping', () => {
    const first = readAutoViewMapping(makeConfig())
    first[0]!.name = '被修改'
    first[0]!.keywords.push('不應保留')

    const second = readAutoViewMapping(makeConfig())
    expect(second[0]!.name).toBe(DEFAULT_AUTO_VIEW_MAPPING[0]!.name)
    expect(second[0]!.keywords).toEqual(DEFAULT_AUTO_VIEW_MAPPING[0]!.keywords)
  })

  it('respects an explicitly saved empty mapping', () => {
    expect(readAutoViewMapping(makeConfig({
      fuxaSetting: { [VIEW_AUTO_MAPPING_KEY]: [] },
    }))).toEqual([])
  })

  it('normalizes names and keywords and ignores invalid entries', () => {
    const config = makeConfig({
      fuxaSetting: {
        [VIEW_AUTO_MAPPING_KEY]: [
          { name: '  消防系統 ', keywords: [' 消防 ', 'co2', '消防', 3, ''] },
          { name: '   ', keywords: ['x'] },
          { keywords: ['y'] },
          null,
        ],
      },
    })

    expect(readAutoViewMapping(config)).toEqual([
      { name: '消防系統', keywords: ['消防', 'co2'] },
    ])
  })
})

describe('validateAutoViewMapping', () => {
  it('accepts a valid mapping', () => {
    expect(validateAutoViewMapping([
      { name: '消防系統', keywords: ['消防', 'co2'] },
    ])).toEqual([])
  })

  it('reports empty names, duplicates, reserved names, and empty keywords', () => {
    const errors = validateAutoViewMapping([
      { name: '', keywords: ['a'] },
      { name: '泵浦', keywords: [] },
      { name: '泵浦', keywords: ['泵'] },
      { name: UNCLASSIFIED_VIEW_NAME, keywords: ['x'] },
    ])

    expect(errors).toEqual([
      '第 1 列：請輸入 View 名稱。',
      '第 2 列：請至少輸入一個關鍵字。',
      '第 3 列：View 名稱「泵浦」重複。',
      `第 4 列：「${UNCLASSIFIED_VIEW_NAME}」是保留名稱，請改用其他名稱。`,
    ])
  })
})

describe('saveAutoViewMapping', () => {
  it('saves normalized mapping while preserving unknown settings and version', () => {
    const config = makeConfig({
      fuxaSetting: {
        version: 3,
        unknownSetting: { keep: true },
      },
      unknownExtra: 'keep',
    })

    saveAutoViewMapping(config, [
      { name: ' 消防系統 ', keywords: ['消防', ' co2 ', '消防'] },
    ])

    expect(config.extra).toMatchObject({ unknownExtra: 'keep' })
    expect((config.extra as Record<string, unknown>).fuxaSetting).toEqual({
      version: 3,
      unknownSetting: { keep: true },
      [VIEW_AUTO_MAPPING_KEY]: [{ name: '消防系統', keywords: ['消防', 'co2'] }],
    })
  })

  it('rejects malformed extra instead of overwriting it', () => {
    const config = makeConfig('not-an-object')
    expect(() => saveAutoViewMapping(config, [
      { name: '消防系統', keywords: ['消防'] },
    ])).toThrow('配置的 extra 欄位不是物件，無法保存一鍵配置分類表。')
  })
})

describe('normalizeAutoViewMapping', () => {
  it('trims names and removes empty or duplicate keywords', () => {
    expect(normalizeAutoViewMapping([
      { name: ' A ', keywords: [' x ', '', 'x', 'y'] },
    ])).toEqual([{ name: 'A', keywords: ['x', 'y'] }])
  })
})

describe('filterAutoViewTags', () => {
  it('excludes auto-filled tags unless requested', () => {
    const tags = [
      makeTag('t1', '消防泵'),
      makeTag('t2', '自動補位', AUTO_FILLED_TAG_DESCRIPTION),
    ]

    expect(filterAutoViewTags(tags, false).map((tag) => tag.id)).toEqual(['t1'])
    expect(filterAutoViewTags(tags, true).map((tag) => tag.id)).toEqual(['t1', 't2'])
  })
})

describe('classifyTagsForViews', () => {
  it('matches by containment, ignores case, and keeps mapping order as priority', () => {
    const tags = [
      makeTag('t1', 'B1F消防泵運轉'),
      makeTag('t2', 'CO2偵測器'),
      makeTag('t3', 'B1F泵浦運轉'),
      makeTag('t4', '一般點位'),
    ]
    const result = classifyTagsForViews(tags, [
      { name: '消防系統', keywords: ['消防', 'co2'] },
      { name: '泵浦系統', keywords: ['泵'] },
    ])

    expect(result.groups.map((group) => ({
      name: group.name,
      tags: group.tags.map((tag) => tag.id),
    }))).toEqual([
      { name: '消防系統', tags: ['t1', 't2'] },
      { name: '泵浦系統', tags: ['t3'] },
    ])
    expect(result.unclassified.map((tag) => tag.id)).toEqual(['t4'])
    expect(result.ambiguous).toEqual([
      { tag: tags[0], groupNames: ['消防系統', '泵浦系統'] },
    ])
  })

  it('classifies common project tag names with the default mapping', () => {
    const tags = [
      makeTag('t1', 'B1F消防泵運轉'),
      makeTag('t2', 'B4F排風機啟動'),
      makeTag('t3', 'R3F安全門(NC)'),
      makeTag('t4', '1 Connection Status'),
      makeTag('t5', 'R2F電梯機房溫度'),
      makeTag('t6', 'B4F廢水泵1運轉'),
      makeTag('t7', 'R3F水箱蓋(NC)'),
    ]

    const result = classifyTagsForViews(tags, DEFAULT_AUTO_VIEW_MAPPING)
    const tagsByGroup = Object.fromEntries(
      result.groups.map((group) => [group.name, group.tags.map((tag) => tag.id)]),
    )

    expect(tagsByGroup).toMatchObject({
      消防系統: ['t1'],
      給排水系統: ['t6', 't7'],
      風機系統: ['t2'],
      電梯系統: ['t5'],
      門禁求救: ['t3'],
      通訊狀態: ['t4'],
    })
    expect(result.unclassified).toEqual([])
  })

  it('sends tags without a name to unclassified', () => {
    const result = classifyTagsForViews(
      [makeTag('t1', '   ')],
      [{ name: '消防系統', keywords: ['消防'] }],
    )

    expect(result.groups[0]?.tags).toEqual([])
    expect(result.unclassified.map((tag) => tag.id)).toEqual(['t1'])
  })
})
