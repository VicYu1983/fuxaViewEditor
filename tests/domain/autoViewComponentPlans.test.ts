import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { IconLibraryEntry } from '../../src/domain/icons/iconLibrary'
import type { IndexedTag } from '../../src/domain/tags/index'
import {
  buildAutoViewComponentPlans,
  summarizeAutoViewPlans,
} from '../../src/domain/views/autoViewComponentPlans'
import { DEFAULT_AUTO_STATE_MAPPING } from '../../src/domain/views/autoViewStateMapping'
import { parseDefaultIconLibrary } from '../../src/features/icons/defaultIconLibrary'

function asset(id: string) {
  return { id, mimeType: 'image/png' as const, dataUrl: `data:image/png;base64,${id}` }
}

function makeTag(id: string, name: string): IndexedTag {
  return {
    id,
    name,
    type: 'Bool',
    memaddress: '100',
    deviceId: 'dev-1',
    deviceName: 'DevA',
    floor: '',
    record: {},
  } as unknown as IndexedTag
}

const generatorMulti: IconLibraryEntry = {
  id: 'set-generator',
  name: '發電機',
  type: 'multi-state',
  normal: asset('gen-normal'),
  states: [
    { key: 'run', name: '運轉', asset: asset('gen-run') },
    { key: 'fault', name: '異常', asset: asset('gen-fault') },
  ],
}

const smokePair: IconLibraryEntry = {
  id: 'pair-smoke',
  name: '排煙風機',
  type: 'pair',
  normal: asset('smoke-normal'),
  alarm: asset('smoke-alarm'),
}

function plan(tags: IndexedTag[], icons: IconLibraryEntry[]) {
  return buildAutoViewComponentPlans({
    tags,
    viewKey: 'view-a',
    stateMapping: DEFAULT_AUTO_STATE_MAPPING,
    icons,
    coilSwitchEnabled: false,
  })
}

describe('buildAutoViewComponentPlans', () => {
  it('groups same-device states into one multi-state component', () => {
    const plans = plan(
      [makeTag('t1', 'B1F發電機運轉'), makeTag('t2', 'B1F發電機異常')],
      [generatorMulti],
    )
    const components = plans.flatMap((device) => device.components)

    expect(components).toHaveLength(1)
    expect(components[0]?.kind).toBe('multi')
    expect(components[0]?.multiBindings?.map((binding) => binding.tagId).sort())
      .toEqual(['t1', 't2'])
  })

  it('falls back to a rectangle for every tag when a multi-state set lacks a state tag', () => {
    const plans = plan([makeTag('t1', 'B1F發電機運轉')], [generatorMulti])
    const components = plans.flatMap((device) => device.components)

    expect(components).toHaveLength(1)
    expect(components[0]?.kind).toBe('rect')
    expect(components[0]?.tagIds).toEqual(['t1'])
    expect(plans[0]?.warnings.length).toBeGreaterThan(0)
  })

  it('creates a pair component and inverts it for (NC) tags', () => {
    const plans = plan([makeTag('t1', 'B4F排煙風機運轉(NC)')], [smokePair])
    const components = plans.flatMap((device) => device.components)

    expect(components).toHaveLength(1)
    expect(components[0]).toMatchObject({
      kind: 'pair',
      tagIds: ['t1'],
      invertIconState: true,
    })
  })

  it('keeps devices on different floors separate', () => {
    const plans = plan(
      [makeTag('t1', 'B4F排煙風機運轉'), makeTag('t2', 'R3F排煙風機運轉')],
      [smokePair],
    )
    expect(plans).toHaveLength(2)
  })

  it('summarizes component counts', () => {
    const plans = plan(
      [
        makeTag('t1', 'B1F發電機運轉'),
        makeTag('t2', 'B1F發電機異常'),
        makeTag('t3', 'B4F排煙風機運轉'),
        makeTag('t4', '一般點位'),
      ],
      [generatorMulti, smokePair],
    )
    const summary = summarizeAutoViewPlans(plans)

    expect(summary.multiComponentCount).toBe(1)
    expect(summary.pairComponentCount).toBe(1)
    expect(summary.rectComponentCount).toBe(1)
  })
})

describe('default icon library asset', () => {
  it('parses the bundled 19-set library', () => {
    const json: unknown = JSON.parse(
      readFileSync(new URL('../../public/default-icon-library.json', import.meta.url), 'utf8'),
    )
    const icons = parseDefaultIconLibrary(json)
    expect(icons).toHaveLength(19)
    expect(new Set(icons.map((icon) => icon.id)).size).toBe(19)
  })
})
