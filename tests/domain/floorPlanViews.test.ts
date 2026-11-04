import { describe, expect, it } from 'vitest'
import type { FuxaConfig } from '../../src/domain/config/types'
import type { FloorPlanTagOffsets } from '../../src/domain/layout/floorPlanViews'
import { DEFAULT_FLOOR_GROUP_FRAME } from '../../src/domain/layout/floorGroupFrame'
import { DEFAULT_GRID } from '../../src/domain/layout/gridSettings'
import {
  getViewFloorPlanSetting,
  getViewFloorPlanTagOffsets,
  layoutFloorViewComponents,
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

  it('lays out floor-plan views with offsets and ignores them otherwise', () => {
    const model = {
      components: [{ key: 'a', tagId: 'tag-1', template: 'rect' as const, label: 'A' }],
      grid: { ...DEFAULT_GRID },
      floorPlanTagOffsets: { 'tag-1': { dx: 5, dy: -10 } },
    }
    const tags = new Map([['tag-1', { floor: '1F' }]])
    const frame = DEFAULT_FLOOR_GROUP_FRAME
    const plain = layoutFloorViewComponents({ ...model, floorPlan: false }, tags, frame, 1024)
    const planned = layoutFloorViewComponents({ ...model, floorPlan: true }, tags, frame, 1024)
    const plainShape = plain.placements[0]?.placement.shape
    const plannedShape = planned.placements[0]?.placement.shape
    if (!plainShape || !plannedShape) throw new Error('Expected placements')

    expect(plannedShape.x).toBe(plainShape.x + 5)
    expect(plannedShape.y).toBe(plainShape.y - 10)
    expect(planned.sections[0]?.entries[0]?.placement.shape).toEqual(plannedShape)
  })
})
