// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { FuxaConfig, FloorGroupFrameSettings, GridSettings } from '../../src/domain/config/types'
import {
  createFloorPlanDataUrl,
  createFloorPlanImage,
  floorPlanKeyForView,
  getFloorPlanLibrary,
  saveFloorPlanLibrary,
} from '../../src/domain/floorPlans/floorPlanLibrary'
import type { FloorPlanImage } from '../../src/domain/floorPlans/floorPlanLibrary'
import { applyModelToView } from '../../src/domain/svg/applyModelToView'
import type { ApplyModel, ApplyModelToViewOptions } from '../../src/domain/svg/applyModelToView'
import { FLOOR_PLAN_ATTRIBUTE } from '../../src/domain/svg/buildFloorPlanNode'
import { getFloorGroupFrameSettings } from '../../src/domain/layout/floorGroupFrame'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function pngDataUrl(width: number, height: number): string {
  const bytes = [
    ...PNG_SIGNATURE,
    0, 0, 0, 13,
    ...Buffer.from('IHDR'),
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff,
  ]
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`
}

function configWith(extra: Record<string, unknown>): FuxaConfig {
  return { hmi: { views: [] }, extra } as unknown as FuxaConfig
}

const grid: GridSettings = {
  columns: 4,
  originX: 60,
  originY: 80,
  gapX: 40,
  gapY: 40,
  labelPosition: 'above',
  labelOffset: 10,
  labelFontSize: 14,
  iconScale: 100,
}

const floorPlan: FloorPlanImage = createFloorPlanImage(pngDataUrl(1152, 768))

describe('floorPlanKeyForView', () => {
  it('uses the building floor name as the key', () => {
    expect(floorPlanKeyForView('A棟/1F')).toBe('A棟/1F')
    expect(floorPlanKeyForView('A棟/B2F')).toBe('A棟/B2F')
  })

  it('returns null for views that are not building floors', () => {
    expect(floorPlanKeyForView('Main')).toBeNull()
    expect(floorPlanKeyForView(undefined)).toBeNull()
  })
})

describe('createFloorPlanImage', () => {
  it('reads width and height from the PNG header', () => {
    expect(createFloorPlanImage(pngDataUrl(1152, 768))).toEqual({
      mimeType: 'image/png',
      dataUrl: pngDataUrl(1152, 768),
      width: 1152,
      height: 768,
    })
  })

  it('rejects non-PNG data', () => {
    expect(() => createFloorPlanImage('data:image/svg+xml;base64,PHN2Zy8+'))
      .toThrow('平面圖必須是有效的 PNG 圖片。')
    expect(() => createFloorPlanImage('data:image/png;base64,AAAA')).toThrow()
    expect(() => createFloorPlanImage(undefined)).toThrow()
  })
})

describe('createFloorPlanDataUrl', () => {
  it('encodes uploaded PNG bytes as a data URL that createFloorPlanImage accepts', () => {
    const dataUrl = pngDataUrl(640, 480)
    const bytes = new Uint8Array(Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'))

    expect(createFloorPlanDataUrl(bytes)).toBe(dataUrl)
    expect(createFloorPlanImage(createFloorPlanDataUrl(bytes))).toMatchObject({ width: 640, height: 480 })
  })
})

describe('floor plan library storage', () => {
  it('round-trips through extra.fuxaSetting.floorPlans', () => {
    const config = configWith({ fuxaSetting: { version: 2, buildingFloorButtons: [] } })
    saveFloorPlanLibrary(config, { 'A棟/1F': floorPlan })

    expect(getFloorPlanLibrary(config)).toEqual({ 'A棟/1F': floorPlan })
    expect((config.extra as Record<string, Record<string, unknown>>).fuxaSetting)
      .toMatchObject({ version: 2, buildingFloorButtons: [] })
  })

  it('returns an empty library when nothing is stored', () => {
    expect(getFloorPlanLibrary(configWith({}))).toEqual({})
  })

  it('rejects keys that are not building floor names', () => {
    expect(() => saveFloorPlanLibrary(configWith({}), { Main: floorPlan }))
      .toThrow('不是有效的建築樓層名稱')
  })
})

describe('applyModelToView floor plan image', () => {
  const frame: FloorGroupFrameSettings = getFloorGroupFrameSettings({} as FuxaConfig)

  function applyOptions(floorPlanImage?: FloorPlanImage): ApplyModelToViewOptions {
    let id = 0
    return {
      Parser: DOMParser as unknown as ApplyModelToViewOptions['Parser'],
      serialize: (doc) => new XMLSerializer().serializeToString(doc),
      allocateId: (prefix) => `${prefix}-${++id}`,
      resolveIcon: () => undefined,
      tags: {},
      floorGroupFrame: frame,
      floorPlanImage,
    }
  }

  function floorModel(): ApplyModel {
    return {
      components: [],
      grid,
      floorPlan: true,
      floorTitles: {},
      floorTitleIds: {},
      floorFrames: {},
      floorFrameIds: {},
      floorFrameShapeIds: {},
    }
  }

  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="768">'
    + '<g data-name="layer"><rect id="keep" x="1" y="1" width="2" height="2"/></g></svg>'

  it('inserts the plan image at the bottom of the layer, sized to the view profile', () => {
    const view = { id: 'v1', name: 'A棟/1F', svgcontent: svg, items: {}, profile: { width: 1024, height: 600 } }
    applyModelToView(view, floorModel(), applyOptions(floorPlan))

    const doc = new DOMParser().parseFromString(view.svgcontent, 'image/svg+xml')
    const image = doc.querySelector(`image[${FLOOR_PLAN_ATTRIBUTE}]`)
    expect(image).not.toBeNull()
    expect(image!.getAttribute('width')).toBe('1024')
    expect(image!.getAttribute('height')).toBe('600')
    expect(image!.getAttribute('preserveAspectRatio')).toBe('none')
    expect(image!.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe(floorPlan.dataUrl)
    expect(image!.parentElement!.firstElementChild).toBe(image)
    expect(doc.querySelector('#keep')).not.toBeNull()
  })

  it('replaces the previous plan image on re-apply and removes it when no plan is set', () => {
    const view = { id: 'v1', name: 'A棟/1F', svgcontent: svg, items: {} }
    applyModelToView(view, floorModel(), applyOptions(floorPlan))
    applyModelToView(view, floorModel(), applyOptions(floorPlan))

    let doc = new DOMParser().parseFromString(view.svgcontent, 'image/svg+xml')
    expect(doc.querySelectorAll(`image[${FLOOR_PLAN_ATTRIBUTE}]`)).toHaveLength(1)

    applyModelToView(view, floorModel(), applyOptions(undefined))
    doc = new DOMParser().parseFromString(view.svgcontent, 'image/svg+xml')
    expect(doc.querySelectorAll(`image[${FLOOR_PLAN_ATTRIBUTE}]`)).toHaveLength(0)
    expect(doc.querySelector('#keep')).not.toBeNull()
  })

  it('does not add a plan image to views that are not floor plans', () => {
    const view = { id: 'v1', name: 'A棟/1F', svgcontent: svg, items: {} }
    const model = { ...floorModel(), floorPlan: false }
    applyModelToView(view, model, applyOptions(floorPlan))

    expect(view.svgcontent).not.toContain(FLOOR_PLAN_ATTRIBUTE)
  })
})
