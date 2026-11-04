// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { FuxaConfig } from '../../src/domain/config/types'
import {
  BUILDING_FLOOR_BUTTON_NAME,
  buildingFloorButtonsNeedSync,
  syncBuildingFloorButtons,
} from '../../src/domain/buildingFloors/buildingFloorButtons'

function config(names: Array<[string, string]>): FuxaConfig {
  return {
    devices: {},
    hmi: {
      views: names.map(([id, name]) => ({
        id,
        name,
        svgcontent: '<svg xmlns="http://www.w3.org/2000/svg"><g><title>Layer 1</title></g></svg>',
        items: {},
      })),
    },
  }
}

function sync(configToSync: FuxaConfig): void {
  let nextId = 0
  syncBuildingFloorButtons(
    configToSync,
    DOMParser,
    (doc) => new XMLSerializer().serializeToString(doc),
    (prefix) => `${prefix}_generated_${++nextId}`,
  )
}

describe('building floor buttons', () => {
  it('creates sorted navigation buttons and highlights the current view', () => {
    const project = config([
      ['floor-3', '排風系統/3F'],
      ['floor-2', '排風系統/2F'],
    ])

    expect(buildingFloorButtonsNeedSync(project)).toBe(true)
    sync(project)

    const views = project.hmi.views as Array<{
      id: string
      svgcontent: string
      items: Record<string, {
        id: string
        name: string
        property: { text: string; events: Array<{ actparam: string }> }
      }>
    }>
    const thirdFloor = views[0]!
    const thirdFloorButtons = Object.values(thirdFloor.items)
      .filter((item) => item.name === BUILDING_FLOOR_BUTTON_NAME)

    expect(thirdFloorButtons.map((button) => button.property.text)).toEqual(['2F', '3F'])
    expect(thirdFloorButtons.map((button) => button.property.events[0]?.actparam))
      .toEqual(['floor-2', 'floor-3'])
    expect(thirdFloor.svgcontent).toContain('data-building-floor-active="true"')
    expect(buildingFloorButtonsNeedSync(project)).toBe(false)

    const oldIds = Object.keys(thirdFloor.items)
    sync(project)
    expect(Object.keys(thirdFloor.items)).toEqual(oldIds)
  })

  it('creates no buttons for a single floor and removes stale generated buttons', () => {
    const project = config([['floor-1', '排風系統/1F']])
    const view = (project.hmi.views as Array<Record<string, unknown>>)[0]!
    view.items = {
      stale: {
        id: 'stale',
        type: 'svg-ext-html_button',
        name: BUILDING_FLOOR_BUTTON_NAME,
        property: {},
      },
    }
    view.svgcontent = '<svg xmlns="http://www.w3.org/2000/svg"><g>'
      + '<title>Layer 1</title><g data-name="fuxa_building_floor_button" id="stale"/>'
      + '</g></svg>'

    expect(buildingFloorButtonsNeedSync(project)).toBe(true)
    sync(project)

    expect(view.items).toEqual({})
    expect(view.svgcontent).not.toContain(BUILDING_FLOOR_BUTTON_NAME)
    expect(buildingFloorButtonsNeedSync(project)).toBe(false)
  })

  it('adopts matching existing FUXA buttons instead of duplicating them', () => {
    const project = config([
      ['floor-2', '排風系統/2F'],
      ['floor-3', '排風系統/3F'],
    ])
    const views = project.hmi.views as Array<{
      id: string
      name: string
      svgcontent: string
      items: Record<string, unknown>
    }>
    for (const view of views) {
      view.items = {
        'legacy-2f': {
          id: 'legacy-2f',
          type: 'svg-ext-html_button',
          name: 'button_1',
          property: {
            text: '2F',
            events: [{ type: 'click', action: 'onpage', actparam: 'floor-2' }],
          },
        },
        'legacy-3f': {
          id: 'legacy-3f',
          type: 'svg-ext-html_button',
          name: 'button_2',
          property: {
            text: '3F',
            events: [{ type: 'click', action: 'onpage', actparam: 'floor-3' }],
          },
        },
      }
      view.svgcontent = '<svg xmlns="http://www.w3.org/2000/svg"><g>'
        + '<title>Layer 1</title>'
        + '<g id="legacy-2f" type="svg-ext-html_button"><foreignObject>'
        + '<BUTTON>2F</BUTTON></foreignObject></g>'
        + '<g id="legacy-3f" type="svg-ext-html_button"><foreignObject>'
        + '<BUTTON>3F</BUTTON></foreignObject></g></g></svg>'
    }

    sync(project)

    for (const view of views) {
      expect(Object.keys(view.items)).toEqual(['legacy-2f', 'legacy-3f'])
      expect(Object.values(view.items).every(
        (item) => (item as { name: string }).name === BUILDING_FLOOR_BUTTON_NAME,
      )).toBe(true)
      expect((view.svgcontent.match(/type="svg-ext-html_button"/g) ?? []).length).toBe(2)
    }
    expect(views[0]!.svgcontent).toContain('background-color:#1d4ed8')
    expect(buildingFloorButtonsNeedSync(project)).toBe(false)
  })

  it('adopts the sample project buttons and preserves its floor-plan image paths', () => {
    const project = JSON.parse(readFileSync(
      resolve(process.cwd(), '..', 'testjson', '測試樓層demo.json'),
      'utf8',
    )) as FuxaConfig

    sync(project)

    const floorViews = (project.hmi.views as Array<{
      name: string
      svgcontent: string
      items: Record<string, { name: string }>
    }>).filter((view) => view.name.startsWith('排風系統/'))
    expect(floorViews).toHaveLength(2)
    for (const view of floorViews) {
      expect(Object.values(view.items).filter(
        (item) => item.name === BUILDING_FLOOR_BUTTON_NAME,
      )).toHaveLength(2)
      expect((view.svgcontent.match(/type="svg-ext-html_button"/g) ?? []).length).toBe(2)
      expect(view.svgcontent).toContain('resources/Drawing2.svg')
    }
    expect(buildingFloorButtonsNeedSync(project)).toBe(false)
  })
})
