import type { FuxaConfig } from '../config/types'
import { isRecord } from '../config/validateFuxaConfig'

const DEFAULT_NAVIGATION_ICON = 'dashboard'

function buildNavigationItems(config: FuxaConfig): Record<string, unknown>[] {
  const layout = isRecord(config.hmi.layout) ? config.hmi.layout : {}
  const navigation = isRecord(layout.navigation) ? layout.navigation : {}
  const existingIcons = new Map<string, string>()
  if (Array.isArray(navigation.items)) {
    for (const item of navigation.items) {
      if (isRecord(item) && typeof item.view === 'string' && typeof item.icon === 'string' && item.icon) {
        existingIcons.set(item.view, item.icon)
      }
    }
  }
  return config.hmi.views.flatMap((view) => {
    if (!isRecord(view) || typeof view.id !== 'string' || !view.id) return []
    return [{
      text: typeof view.name === 'string' && view.name ? view.name : view.id,
      view: view.id,
      icon: existingIcons.get(view.id) ?? DEFAULT_NAVIGATION_ICON,
      image: '',
      permission: 0,
      children: [],
    }]
  })
}

export function navigationNeedsSync(config: FuxaConfig): boolean {
  if (!isRecord(config.hmi.layout)) return false
  const current = isRecord(config.hmi.layout.navigation) ? config.hmi.layout.navigation.items : undefined
  return JSON.stringify(current) !== JSON.stringify(buildNavigationItems(config))
}

// Rebuilds hmi.layout.navigation.items so every view has exactly one navigation entry.
export function syncNavigationItems(config: FuxaConfig): boolean {
  if (!navigationNeedsSync(config)) return false
  const layout = config.hmi.layout as Record<string, unknown>
  const navigation = isRecord(layout.navigation) ? layout.navigation : {}
  layout.navigation = { ...navigation, items: buildNavigationItems(config) }
  return true
}
