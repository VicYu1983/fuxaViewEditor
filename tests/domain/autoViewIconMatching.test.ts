import { describe, expect, it } from 'vitest'
import type { IconLibraryEntry } from '../../src/domain/icons/iconLibrary'
import {
  matchAutoViewIcon,
  normalizeAutoViewText,
} from '../../src/domain/views/autoViewIconMatching'
import { DEFAULT_AUTO_STATE_MAPPING } from '../../src/domain/views/autoViewStateMapping'

function asset(id: string) {
  return { id, mimeType: 'image/png' as const, dataUrl: `data:image/png;base64,${id}` }
}

function pair(name: string): IconLibraryEntry {
  return {
    id: `pair-${name}`,
    name,
    type: 'pair',
    normal: asset(`${name}-n`),
    alarm: asset(`${name}-a`),
  }
}

describe('normalizeAutoViewText', () => {
  it('treats variant characters as equal', () => {
    expect(normalizeAutoViewText('汙水泵')).toBe(normalizeAutoViewText('污水泵'))
    expect(normalizeAutoViewText('撒水')).toBe(normalizeAutoViewText('灑水'))
    expect(normalizeAutoViewText('煙')).toBe(normalizeAutoViewText('烟'))
  })
})

describe('matchAutoViewIcon', () => {
  it('prefers the longest icon name contained in the tag name', () => {
    const icons = [pair('發電機'), pair('發電機低油位')]
    const match = matchAutoViewIcon('B1F發電機低油位', icons, DEFAULT_AUTO_STATE_MAPPING)
    expect(match?.icon.name).toBe('發電機低油位')
  })

  it('matches variant characters in the tag name', () => {
    const icons = [pair('污水泵')]
    const match = matchAutoViewIcon('B1F汙水泵運轉', icons, DEFAULT_AUTO_STATE_MAPPING)
    expect(match?.icon.name).toBe('污水泵')
  })

  it('falls back to the generic pump icon when no specific pump matches', () => {
    const icons = [pair('消防泵'), pair('泵浦')]
    const match = matchAutoViewIcon('B2F泵浦運轉', icons, DEFAULT_AUTO_STATE_MAPPING)
    expect(match?.icon.name).toBe('泵浦')
  })

  it('falls back to the fire pump icon for a fire-pump tag with a different wording', () => {
    const icons = [pair('消防泵'), pair('泵浦')]
    const match = matchAutoViewIcon('B1F消防水泵運轉', icons, DEFAULT_AUTO_STATE_MAPPING)
    expect(match?.icon.name).toBe('消防泵')
  })

  it('returns undefined when nothing matches', () => {
    const match = matchAutoViewIcon('一般點位', [pair('發電機')], DEFAULT_AUTO_STATE_MAPPING)
    expect(match).toBeUndefined()
  })
})
