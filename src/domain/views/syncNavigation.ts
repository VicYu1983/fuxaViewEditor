import type { FuxaConfig } from '../config/types'
import { isRecord } from '../config/validateFuxaConfig'
import { groupBuildingFloors } from '../buildingFloors/buildingFloors'

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
  const views = config.hmi.views.flatMap((view) => (
    isRecord(view)
    && typeof view.id === 'string'
    && view.id
    && typeof view.name === 'string'
      ? [{ id: view.id, name: view.name }]
      : []
  ))
  const viewsById = new Map(views.map((view) => [view.id, view]))
  const floorGroups = groupBuildingFloors(views)
  const floorsByViewId = new Map(
    [...floorGroups.values()].flatMap((floors) => floors.map((floor) => [floor.id, floor] as const)),
  )
  const emittedSystems = new Set<string>()
  const customItems = Array.isArray(navigation.items)
    ? navigation.items.filter((item) => {
      if (!isRecord(item) || typeof item.view !== 'string') return true
      const target = viewsById.get(item.view)
      if (!target) return true
      const floor = floorsByViewId.get(item.view)
      const editorLabel = floor?.system ?? target.name
      return item.text !== editorLabel && item.text !== target.name && item.text !== target.id
    })
    : []

  const generatedItems = views.flatMap((view) => {
    const floor = floorsByViewId.get(view.id)
    if (floor) {
      if (emittedSystems.has(floor.system)) return []
      emittedSystems.add(floor.system)
      const lowestFloor = floorGroups.get(floor.system)?.[0]
      if (!lowestFloor) return []
      const icon = floorGroups.get(floor.system)
        ?.map((candidate) => existingIcons.get(candidate.id))
        .find((candidate): candidate is string => Boolean(candidate))
      return [{
        text: floor.system,
        view: lowestFloor.id,
        icon: existingIcons.get(lowestFloor.id) ?? icon ?? DEFAULT_NAVIGATION_ICON,
        image: '',
        permission: 0,
        children: [],
      }]
    }
    return [{
      text: view.name || view.id,
      view: view.id,
      icon: existingIcons.get(view.id) ?? DEFAULT_NAVIGATION_ICON,
      image: '',
      permission: 0,
      children: [],
    }]
  })
  return [...generatedItems, ...customItems.filter(isRecord)]
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
