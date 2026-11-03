import { describe, expect, it } from 'vitest'
import type { ExportViewModel } from '../../src/domain/config/prepareFuxaConfigExport'
import type { ParsedFuxaConfig } from '../../src/domain/config/types'
import { buildDuplicateTagGroups, buildTagViewOptions } from '../../src/domain/tags/tagViews'
import type { IndexedTag } from '../../src/domain/tags'

function tag(id: string, name: string): IndexedTag {
  return { id, name } as unknown as IndexedTag
}

describe('buildDuplicateTagGroups', () => {
  it('groups tags by trimmed, case-insensitive name and ignores blank names', () => {
    const groups = buildDuplicateTagGroups([
      tag('a', 'Pump '),
      tag('b', 'pump'),
      tag('c', 'Valve'),
      tag('d', '   '),
      tag('e', ''),
    ])
    expect(groups.map((group) => group.map((item) => item.id))).toEqual([['a', 'b']])
  })
})

describe('buildTagViewOptions', () => {
  it('collects views from raw hmi items and from editor models without duplicates', () => {
    const config = {
      rawConfig: {
        hmi: {
          views: [
            { id: 'v1', name: 'Floor 1', items: { i1: { property: { variableId: 't1' } } } },
          ],
        },
      },
      views: [{ id: 'v1', key: 'v1', name: 'Floor 1' }],
    } as unknown as Pick<ParsedFuxaConfig, 'rawConfig' | 'views'>
    const models = new Map([
      ['v1', {
        components: [
          { key: 'k1', tagId: 't1' },
          { key: 'k2', tagId: 't2', multiStateBindings: [{ tagId: 't3' }] },
        ],
      }],
    ]) as unknown as ReadonlyMap<string, ExportViewModel>

    const options = buildTagViewOptions(config, models)

    expect(options.get('t1')?.map((view) => view.id)).toEqual(['v1'])
    expect(options.get('t2')?.map((view) => view.id)).toEqual(['v1'])
    expect(options.get('t3')?.map((view) => view.id)).toEqual(['v1'])
  })
})
