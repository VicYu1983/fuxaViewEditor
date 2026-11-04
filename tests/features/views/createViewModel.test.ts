import { describe, expect, it } from 'vitest'
import type { FuxaConfig } from '../../../src/domain/config/types'
import { DEFAULT_GRID } from '../../../src/domain/layout/gridSettings'
import { createEmptyViewModel } from '../../../src/features/views/createViewModel'

const config: FuxaConfig = {
  devices: {},
  hmi: { views: [] },
}

describe('createEmptyViewModel', () => {
  it('creates an empty model with a copied default grid', () => {
    const model = createEmptyViewModel(config, 'v_new')

    expect(model.viewId).toBe('v_new')
    expect(model.components).toEqual([])
    expect(model.originalComponents).toEqual([])
    expect(model.floorTitles).toEqual({})
    expect(model.floorFrameShapeIds).toEqual({})
    expect(model.grid).toEqual(DEFAULT_GRID)
    expect(model.grid).not.toBe(DEFAULT_GRID)
  })

  it('does not share grid objects between models', () => {
    const first = createEmptyViewModel(config, 'v_a')
    const second = createEmptyViewModel(config, 'v_b')

    expect(first.grid).not.toBe(second.grid)
  })
})
