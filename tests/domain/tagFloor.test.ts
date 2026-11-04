import { describe, expect, it } from 'vitest'
import type { FuxaTag } from '../../src/domain/config/types'
import {
  compareFloors,
  getTagFloor,
  groupByFloor,
  normalizeFloor,
  setTagFloor,
} from '../../src/domain/tags/floor'

describe('normalizeFloor', () => {
  it('normalizes basement and above-ground labels', () => {
    expect(normalizeFloor('b2')).toBe('B2F')
    expect(normalizeFloor('B 12 F')).toBe('B12F')
    expect(normalizeFloor(' 3f ')).toBe('3F')
  })

  it('returns an empty string for blank or non-string input and keeps other labels', () => {
    expect(normalizeFloor('   ')).toBe('')
    expect(normalizeFloor(undefined)).toBe('')
    expect(normalizeFloor(3)).toBe('')
    expect(normalizeFloor('屋頂')).toBe('屋頂')
  })
})

describe('compareFloors', () => {
  it('sorts basements, levels, roof, other labels, then unset floors last', () => {
    const sorted = ['', 'Other', '屋頂', '2F', 'B1F', '1F', 'B2F'].sort(compareFloors)
    expect(sorted).toEqual(['B2F', 'B1F', '1F', '2F', '屋頂', 'Other', ''])
  })
})

describe('groupByFloor', () => {
  it('groups by normalized floor, sorts groups, and titles unset floors', () => {
    const groups = groupByFloor(
      [
        { id: 'a', floor: '2f' },
        { id: 'b', floor: '2F' },
        { id: 'c', floor: '' },
        { id: 'd', floor: 'B1' },
      ],
      (item) => item.floor,
    )

    expect(groups.map((group) => group.floor)).toEqual(['B1F', '2F', ''])
    expect(groups.map((group) => group.title)).toEqual(['B1F', '2F', '未設定樓層'])
    expect(groups[1]?.items.map((item) => item.id)).toEqual(['a', 'b'])
  })
})

describe('tag floor helpers', () => {
  it('reads and normalizes the floor stored in tag extra', () => {
    expect(getTagFloor({ extra: { floor: 'b3' } })).toBe('B3F')
    expect(getTagFloor({})).toBe('')
  })

  it('sets a normalized floor and keeps other extra fields', () => {
    const tag = { name: 't', extra: { floor: '1F', other: 1 } } as unknown as FuxaTag

    expect(setTagFloor(tag, 'b1')).toBe('B1F')
    expect(tag.extra).toEqual({ floor: 'B1F', other: 1 })
  })

  it('removes the floor and drops empty extra when nothing else remains', () => {
    const tag = { name: 't', extra: { floor: '1F' } } as unknown as FuxaTag

    expect(setTagFloor(tag, '')).toBe('')
    expect(tag.extra).toBeUndefined()
  })

  it('rejects non-record tags', () => {
    expect(() => setTagFloor(null as unknown as FuxaTag, '1F')).toThrow('無效的 Tag 資料。')
  })
})
