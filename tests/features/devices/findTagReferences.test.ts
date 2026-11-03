import { describe, expect, it } from 'vitest'
import type { ExportViewModel } from '../../../src/domain/config/prepareFuxaConfigExport'
import { findTagReferences } from '../../../src/features/devices/findTagReferences'

describe('findTagReferences', () => {
  it('finds components bound directly or through multi-state bindings', () => {
    const models = new Map([
      ['v1', {
        components: [
          { key: 'a', tagId: 't1' },
          { key: 'b', tagId: 't2', multiStateBindings: [{ tagId: 't1' }] },
          { key: 'c', tagId: 't3' },
        ],
      }],
      ['v2', { components: [{ key: 'd', tagId: 't9' }] }],
    ]) as unknown as ReadonlyMap<string, ExportViewModel>

    const groups = findTagReferences(models, new Set(['t1']))

    expect(groups.map((group) => group.viewId)).toEqual(['v1'])
    expect(groups[0]?.components.map((component) => component.key)).toEqual(['a', 'b'])
    expect(groups[0]?.model).toBe(models.get('v1'))
  })

  it('matches any tag id in the set', () => {
    const models = new Map([
      ['v1', { components: [{ key: 'a', tagId: 't1' }, { key: 'b', tagId: 't2' }] }],
    ]) as unknown as ReadonlyMap<string, ExportViewModel>

    expect(findTagReferences(models, new Set(['t2'])).flatMap((group) =>
      group.components.map((component) => component.key))).toEqual(['b'])
  })
})
