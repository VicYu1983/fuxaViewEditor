import { describe, expect, it } from 'vitest'
import type { FuxaConfig } from '../../src/domain/config/types'
import {
  getViewFloorPlanSetting,
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
})
