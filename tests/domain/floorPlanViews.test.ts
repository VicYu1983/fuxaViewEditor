import { describe, expect, it } from 'vitest'
import type { FuxaConfig } from '../../src/domain/config/types'
import type { FloorLayoutResult } from '../../src/domain/layout/floorLayout'
import type { FloorPlanTagOffsets } from '../../src/domain/layout/floorPlanViews'
import {
  getViewFloorPlanSetting,
  getViewFloorPlanTagOffsets,
  offsetFloorLayoutPlacements,
  saveFloorPlanTagOffsets,
  saveFloorPlanViewSettings,
} from '../../src/domain/layout/floorPlanViews'


function configWith(extra: unknown): FuxaConfig {
  return { hmi: { views: [] }, extra } as unknown as FuxaConfig
}

describe('floorPlanViews', () => {
  it('reads the floor-plan flag from extra.fuxaSetting', () => {
    const config = configWith({ fuxaSetting: { floorPlanViewIds: ['view-a'] } })
    expect(getViewFloorPlanSetting(config, 'view-a')).toBe(true)
    expect(getViewFloorPlanSetting(config, 'view-b')).toBe(false)
    expect(getViewFloorPlanSetting(configWith(undefined), 'view-a')).toBe(false)
  })

  it('applies flags, prunes inactive views, and keeps other tool settings', () => {
    const config = configWith({
      fuxaSetting: { floorPlanViewIds: ['view-a', 'gone'], siteNameLabel: 'site' },
    })
    const ids = saveFloorPlanViewSettings(
      config,
      ['view-a', 'view-b'],
      new Map([['view-a', false], ['view-b', true], ['gone', true]]),
    )
    expect(ids).toEqual(['view-b'])
    expect(config.extra).toEqual({
      fuxaSetting: { floorPlanViewIds: ['view-b'], siteNameLabel: 'site' },
    })
  })

  it('refuses to overwrite a non-object extra', () => {
    expect(() => saveFloorPlanViewSettings(configWith([]), [], new Map()))
      .toThrow(/extra/)
  })

  it('stores tag offsets per view and drops empty entries', () => {
    const config = configWith({ fuxaSetting: { siteNameLabel: 'site' } })
    saveFloorPlanTagOffsets(
      config,
      ['view-a', 'view-b'],
      new Map<string, FloorPlanTagOffsets>([
        ['view-a', { 'tag-1': { dx: 10, dy: -5 }, 'tag-2': { dx: Number.NaN, dy: 0 } }],
        ['view-b', {}],
      ]),
    )
    expect(getViewFloorPlanTagOffsets(config, 'view-a')).toEqual({ 'tag-1': { dx: 10, dy: -5 } })
    expect(getViewFloorPlanTagOffsets(config, 'view-b')).toEqual({})
    expect(config.extra).toEqual({
      fuxaSetting: {
        siteNameLabel: 'site',
        floorPlanTagOffsets: { 'view-a': { 'tag-1': { dx: 10, dy: -5 } } },
      },
    })

    saveFloorPlanTagOffsets(config, ['view-a'], new Map([['view-a', {}]]))
    expect(config.extra).toEqual({ fuxaSetting: { siteNameLabel: 'site' } })
  })

  it('shifts only the placements of tags with offsets', () => {
    const layout = {
      sections: [],
      placements: [
        { component: { tagId: 'tag-1' }, placement: { shape: { x: 100, y: 50, width: 20, height: 10 }, label: { x: 110, y: 70, anchor: 'middle' } } },
        { component: { tagId: 'tag-2' }, placement: { shape: { x: 0, y: 0, width: 20, height: 10 }, label: { x: 10, y: 20, anchor: 'middle' } } },
      ],
    } as unknown as FloorLayoutResult
    const moved = offsetFloorLayoutPlacements(layout, { 'tag-1': { dx: 5, dy: -10 } })
    expect(moved.placements[0]?.placement.shape).toMatchObject({ x: 105, y: 40, width: 20, height: 10 })
    expect(moved.placements[1]?.placement.shape).toMatchObject({ x: 0, y: 0 })
    expect(layout.placements[0]?.placement.shape).toMatchObject({ x: 100, y: 50 })
  })

  it('moves the label together with the shape', () => {
    const layout = {
      sections: [],
      placements: [
        {
          component: { tagId: 'tag-1' },
          placement: {
            shape: { x: 100, y: 50, width: 20, height: 10 },
            label: { x: 110, y: 70, anchor: 'middle' },
          },
        },
      ],
    } as unknown as FloorLayoutResult
    const moved = offsetFloorLayoutPlacements(layout, { 'tag-1': { dx: 5, dy: -10 } })
    expect(moved.placements[0]?.placement.label).toMatchObject({ x: 115, y: 60, anchor: 'middle' })
    expect(layout.placements[0]?.placement.label).toMatchObject({ x: 110, y: 70 })
  })
})
