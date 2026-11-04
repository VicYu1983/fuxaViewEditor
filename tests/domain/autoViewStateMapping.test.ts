import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AUTO_STATE_MAPPING,
  parseTagState,
} from '../../src/domain/views/autoViewStateMapping'

describe('parseTagState', () => {
  it('strips a trailing state keyword and keeps the floor prefix in the base name', () => {
    expect(parseTagState('B4F排煙風機運轉', DEFAULT_AUTO_STATE_MAPPING)).toEqual({
      base: 'B4F排煙風機',
      state: '運轉',
      normallyClosed: false,
    })
  })

  it('detects (NC) as normally closed without treating it as a state', () => {
    expect(parseTagState('B4F排煙風機運轉(NC)', DEFAULT_AUTO_STATE_MAPPING)).toEqual({
      base: 'B4F排煙風機',
      state: '運轉',
      normallyClosed: true,
    })
  })

  it('prefers the longest matching keyword', () => {
    expect(parseTagState('B1F泵浦超高液位', DEFAULT_AUTO_STATE_MAPPING)).toMatchObject({
      base: 'B1F泵浦',
      state: '水位過高',
    })
  })

  it('returns the whole name when no state keyword matches', () => {
    expect(parseTagState('一般點位', DEFAULT_AUTO_STATE_MAPPING)).toEqual({
      base: '一般點位',
      normallyClosed: false,
    })
  })
})
