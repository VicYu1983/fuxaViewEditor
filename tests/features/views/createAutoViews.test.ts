import { describe, expect, it } from 'vitest'
import type { FuxaConfig } from '../../../src/domain/config/types'
import type { SvgParser } from '../../../src/domain/svg/parseSvg'
import { AUTO_FILLED_TAG_DESCRIPTION } from '../../../src/domain/tags/index'
import {
  UNCLASSIFIED_VIEW_NAME,
  VIEW_AUTO_MAPPING_KEY,
} from '../../../src/domain/views/autoViewMapping'
import { buildTagIndex } from '../../../src/domain/tags/index'
import { createAutoViews } from '../../../src/features/views/createAutoViews'

function fakeParser(source: string): XMLDocument {
  const ids = Array.from(source.matchAll(/\bid="([^"]+)"/g), (match) => match[1]!)
  const elements = ids.map((id) => ({
    getAttribute(name: string) {
      return name === 'id' ? id : null
    },
  }))
  const root = {
    localName: 'svg',
    getAttribute() {
      return null
    },
  }
  return {
    documentElement: root,
    getElementsByTagName(name: string) {
      if (name === 'parsererror') return []
      if (name === '*') return [root, ...elements]
      return []
    },
  } as unknown as XMLDocument
}

class TestParser implements SvgParser {
  parseFromString(source: string, mimeType: 'image/svg+xml'): XMLDocument {
    if (mimeType !== 'image/svg+xml') throw new Error('Unexpected MIME type')
    return fakeParser(source)
  }
}

function createRuntime() {
  let sequence = 1
  return {
    Parser: TestParser,
    serialize: () => '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    crypto: {
      getRandomValues(bytes: Uint8Array<ArrayBuffer>) {
        bytes.fill(sequence)
        sequence += 1
        return bytes
      },
    },
  }
}

function makeConfig(): FuxaConfig {
  return {
    devices: {
      d1: {
        id: 'd1',
        name: 'PLC',
        tags: {
          t1: { id: 't1', name: 'B1F消防泵運轉', type: 'Bool', memaddress: '000000' },
          t2: { id: 't2', name: 'B1F泵浦運轉', type: 'Bool', memaddress: '100' },
          t3: { id: 't3', name: '一般點位', type: 'Bool', memaddress: '101' },
          t4: {
            id: 't4',
            name: '自動補位點',
            type: 'Bool',
            memaddress: '102',
            description: AUTO_FILLED_TAG_DESCRIPTION,
          },
        },
      },
    },
    hmi: {
      views: [{
        id: 'v_old',
        name: '舊 View',
        profile: { width: 1280, height: 720 },
        items: {},
        svgcontent: '<svg xmlns="http://www.w3.org/2000/svg" id="oldSvg"></svg>',
      }],
      layout: {
        start: 'v_old',
        navigation: {
          mode: 'over',
          items: [{ view: 'v_old', text: '舊 View', icon: 'dashboard' }],
        },
      },
    },
    extra: { fuxaSetting: { version: 2, unknown: 'keep' } },
  }
}

describe('createAutoViews', () => {
  it('clears old views, creates one view per matched group, and adds tags', () => {
    const config = makeConfig()
    const result = createAutoViews(config, {
      groups: [
        { name: '消防系統', keywords: ['消防', 'co2'] },
        { name: '泵浦系統', keywords: ['泵'] },
      ],
      tags: [...buildTagIndex(config).values()],
    }, createRuntime())

    expect(result.config.hmi.views.map((view) => (
      typeof view === 'object' && view !== null ? (view as Record<string, unknown>).name : ''
    ))).toEqual(['消防系統', '泵浦系統', UNCLASSIFIED_VIEW_NAME])
    expect(result.viewIds).toHaveLength(3)
    expect(result.addedTagCount).toBe(3)
    expect(result.unclassifiedTagCount).toBe(1)
    expect(result.skippedTagCount).toBe(1)
    expect((result.config.hmi.views[0] as Record<string, unknown>).profile).toMatchObject({
      width: 1280,
      height: 720,
    })

    const layout = result.config.hmi.layout as Record<string, unknown>
    expect(layout.start).toBe(result.viewIds[0])
    expect((layout.navigation as Record<string, unknown>).items).toEqual([])

    expect(result.config.extra).toMatchObject({
      fuxaSetting: {
        version: 2,
        unknown: 'keep',
        [VIEW_AUTO_MAPPING_KEY]: [
          { name: '消防系統', keywords: ['消防', 'co2'] },
          { name: '泵浦系統', keywords: ['泵'] },
        ],
      },
    })

    const fireModel = result.models.get(result.viewIds[0]!)
    expect(fireModel?.components.map((component) => ({
      tagId: component.tagId,
      template: component.template,
    }))).toEqual([{ tagId: 't1', template: 'switch' }])

    const pumpModel = result.models.get(result.viewIds[1]!)
    expect(pumpModel?.components.map((component) => ({
      tagId: component.tagId,
      template: component.template,
    }))).toEqual([{ tagId: 't2', template: 'rect' }])

    const unclassifiedModel = result.models.get(result.viewIds[2]!)
    expect(unclassifiedModel?.components.map((component) => component.tagId)).toEqual(['t3'])
  })

  it('can include auto-filled tags and disable coil switches', () => {
    const config = makeConfig()
    const result = createAutoViews(config, {
      groups: [{ name: '消防系統', keywords: ['消防'] }],
      tags: [...buildTagIndex(config).values()],
      includeAutoFilled: true,
      coilSwitchEnabled: false,
    }, createRuntime())

    expect(result.addedTagCount).toBe(4)
    expect(result.skippedTagCount).toBe(0)
    expect(result.unclassifiedTagCount).toBe(3)
    expect(result.models.get(result.viewIds[0]!)?.components[0]?.template).toBe('rect')
  })

  it('creates a blank MainView when there are no tags to add', () => {
    const config = makeConfig()
    const result = createAutoViews(config, {
      groups: [{ name: '消防系統', keywords: ['消防'] }],
      tags: [],
    }, createRuntime())

    expect(result.viewIds).toHaveLength(1)
    expect(result.models.get(result.viewIds[0]!)?.components).toEqual([])
    expect((result.config.hmi.views[0] as Record<string, unknown>).name).toBe('MainView')
    expect(result.addedTagCount).toBe(0)
  })

  it('rejects an invalid mapping without changing the input config', () => {
    const config = makeConfig()
    const snapshot = JSON.stringify(config)

    expect(() => createAutoViews(config, {
      groups: [{ name: UNCLASSIFIED_VIEW_NAME, keywords: ['消防'] }],
      tags: [],
    }, createRuntime())).toThrow(`「${UNCLASSIFIED_VIEW_NAME}」是保留名稱`)

    expect(JSON.stringify(config)).toBe(snapshot)
  })

  it('saves the mapping even when every tag goes to the unclassified view', () => {
    const config = makeConfig()
    const result = createAutoViews(config, {
      groups: [{ name: '消防系統', keywords: ['不存在'] }],
      tags: [...buildTagIndex(config).values()],
    }, createRuntime())

    expect(result.config.hmi.views.map((view) => (
      typeof view === 'object' && view !== null ? (view as Record<string, unknown>).name : ''
    ))).toEqual([UNCLASSIFIED_VIEW_NAME])
    expect(readMapping(result.config)).toEqual([
      { name: '消防系統', keywords: ['不存在'] },
    ])
  })
})

function readMapping(config: FuxaConfig) {
  return ((config.extra as Record<string, unknown>)?.fuxaSetting as Record<string, unknown>)[VIEW_AUTO_MAPPING_KEY]
}

describe('createAutoViews with icon library', () => {
  it('binds a pair icon and saves the state mapping and icon library', () => {
    const config = makeConfig()
    const d1 = (config.devices as Record<string, { tags: Record<string, unknown> }>).d1!
    d1.tags.t5 = {
      id: 't5',
      name: 'B4F排煙風機運轉(NC)',
      type: 'Bool',
      memaddress: '103',
    }
    const iconLibrary = [{
      id: 'pair-smoke',
      name: '排煙風機',
      type: 'pair' as const,
      normal: { id: 'smoke-n', mimeType: 'image/png' as const, dataUrl: 'data:image/png;base64,AA==' },
      alarm: { id: 'smoke-a', mimeType: 'image/png' as const, dataUrl: 'data:image/png;base64,AA==' },
    }]
    const result = createAutoViews(config, {
      groups: [{ name: '風機系統', keywords: ['風機'] }],
      tags: [...buildTagIndex(config).values()].filter((tag) => tag.id === 't5'),
      iconLibrary,
    }, createRuntime())

    expect(result.pairComponentCount).toBe(1)
    expect(result.iconWarningCount).toBe(0)
    const extra = result.config.extra as Record<string, unknown>
    expect(extra.fuxaSetting).toMatchObject({ viewAutoStateMapping: expect.any(Array) })
    expect(JSON.stringify(result.config.extra)).toContain('smoke-n')
  })
})

describe('saveAutoViewMapping via createAutoViews', () => {
  it('does not downgrade a newer settings version', () => {
    const config = makeConfig()
    config.extra = { fuxaSetting: { version: 9 } }
    const result = createAutoViews(config, {
      groups: [{ name: '消防系統', keywords: ['消防'] }],
      tags: [],
    }, createRuntime())

    expect(((result.config.extra as Record<string, unknown>)?.fuxaSetting as Record<string, unknown>).version).toBe(9)
  })
})
