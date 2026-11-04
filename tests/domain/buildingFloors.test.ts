import { describe, expect, it } from 'vitest'
import {
  groupBuildingFloors,
  parseBuildingFloorName,
} from '../../src/domain/buildingFloors/buildingFloors'

describe('parseBuildingFloorName', () => {
  it.each([
    ['排風系統/2F', { system: '排風系統', floorLabel: '2F', floorNumber: 2 }],
    ['排風系統/3樓', { system: '排風系統', floorLabel: '3樓', floorNumber: 3 }],
    ['排風系統/4f', { system: '排風系統', floorLabel: '4f', floorNumber: 4 }],
  ])('parses %s', (name, expected) => {
    expect(parseBuildingFloorName(name)).toEqual(expected)
  })

  it.each(['MainView', '/2F', '排風系統/FAN', '排風系統/B1', '排風系統/2F/南側'])(
    'rejects %s',
    (name) => {
      expect(parseBuildingFloorName(name)).toBeNull()
    },
  )
})

describe('groupBuildingFloors', () => {
  it('groups matching views and sorts each system by floor number', () => {
    const groups = groupBuildingFloors([
      { id: 'floor-3', name: '排風系統/3F' },
      { id: 'main', name: 'MainView' },
      { id: 'floor-1', name: '排風系統/1F' },
      { id: 'pump-2', name: '泵浦/2樓' },
    ])

    expect(groups.get('排風系統')?.map((floor) => floor.id)).toEqual(['floor-1', 'floor-3'])
    expect(groups.get('泵浦')?.map((floor) => floor.floorLabel)).toEqual(['2樓'])
    expect(groups.has('MainView')).toBe(false)
  })
})
