import { describe, expect, it } from 'vitest'
import type { FuxaConfig } from '../../src/domain/config/types'
import {
  navigationNeedsSync,
  syncNavigationItems,
} from '../../src/domain/views/syncNavigation'

describe('syncNavigationItems', () => {
  it('creates one navigation item per floor system pointing to its lowest floor', () => {
    const config: FuxaConfig = {
      devices: {},
      hmi: {
        views: [
          { id: 'main', name: 'MainView' },
          { id: 'floor-3', name: '排風系統/3F' },
          { id: 'floor-1', name: '排風系統/1F' },
          { id: 'floor-2', name: '泵浦/2F' },
        ],
        layout: {
          navigation: {
            items: [{ text: '自訂快捷', view: 'main', icon: 'star', custom: true }],
          },
        },
      },
    }

    expect(navigationNeedsSync(config)).toBe(true)
    expect(syncNavigationItems(config)).toBe(true)
    const navigation = config.hmi.layout as {
      navigation: { items: Array<{ text: string; view: string }> }
    }
    expect(navigation.navigation.items).toEqual([
      expect.objectContaining({ text: 'MainView', view: 'main' }),
      expect.objectContaining({ text: '排風系統', view: 'floor-1' }),
      expect.objectContaining({ text: '泵浦', view: 'floor-2' }),
      { text: '自訂快捷', view: 'main', icon: 'star', custom: true },
    ])
    expect(navigationNeedsSync(config)).toBe(false)
  })
})
