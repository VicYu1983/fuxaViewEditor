export interface BuildingFloorView {
  id: string
  name: string
}

export interface BuildingFloor extends BuildingFloorView {
  system: string
  floorLabel: string
  floorNumber: number
}

export function parseBuildingFloorName(
  viewName: string,
): Omit<BuildingFloor, 'id' | 'name'> | null {
  const separator = viewName.indexOf('/')
  if (separator <= 0) return null

  const system = viewName.slice(0, separator)
  const floorLabel = viewName.slice(separator + 1)
  const match = /^(\d+)(F|樓)$/i.exec(floorLabel)
  if (!system.trim() || !match) return null

  return {
    system,
    floorLabel,
    floorNumber: Number(match[1]),
  }
}

export function groupBuildingFloors(
  views: readonly BuildingFloorView[],
): Map<string, BuildingFloor[]> {
  const groups = new Map<string, BuildingFloor[]>()
  for (const view of views) {
    const parsed = parseBuildingFloorName(view.name)
    if (!parsed) continue
    const floor = { ...view, ...parsed }
    const group = groups.get(floor.system) ?? []
    group.push(floor)
    groups.set(floor.system, group)
  }

  for (const floors of groups.values()) {
    floors.sort((left, right) => left.floorNumber - right.floorNumber)
  }
  return groups
}
