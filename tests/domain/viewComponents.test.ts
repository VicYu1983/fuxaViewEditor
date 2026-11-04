import { describe, expect, it } from 'vitest'
import type { FuxaConfig } from '../../src/domain/config/types'
import type { ManagedComponentRecord } from '../../src/domain/svg/readManagedComponents'
import {
  getStoredViewComponents,
  normalizeStoredComponent,
  reconcileManagedComponents,
  saveViewComponents,
} from '../../src/domain/views/viewComponents'

function config(extra?: unknown): FuxaConfig {
  const value: FuxaConfig = { devices: {}, hmi: { views: [] } }
  if (extra !== undefined) value.extra = extra
  return value
}

function record(overrides: Partial<ManagedComponentRecord> = {}): ManagedComponentRecord {
  return {
    key: 'loaded-1',
    seq: 1,
    tagId: 'tag-1',
    label: 'Pump',
    template: 'rect',
    palette: 'normal',
    shapeId: 'shape-1',
    labelId: 'label-1',
    shapeInnerIds: ['inner-1', null],
    managed: true,
    ...overrides,
  }
}

const tagsExist = () => true

describe('viewComponents storage', () => {
  it('stores only managed components with a clean definition', () => {
    const source = config({ fuxaSetting: { keep: 1 } })
    saveViewComponents(source, ['v1', 'v2'], new Map<string, unknown[]>([
      ['v1', [record(), { managed: false, shapeId: 'existing', tagId: 'x' }]],
      ['v2', []],
    ]))

    const settings = (source.extra as { fuxaSetting: Record<string, unknown> }).fuxaSetting
    expect(settings.keep).toBe(1)
    expect(settings.viewComponents).toEqual({
      v1: [{
        seq: 1,
        tagId: 'tag-1',
        label: 'Pump',
        template: 'rect',
        palette: 'normal',
        shapeId: 'shape-1',
        labelId: 'label-1',
        shapeInnerIds: ['inner-1', null],
      }],
    })
    expect(getStoredViewComponents(source, 'v2')).toBeUndefined()
  })

  it('removes entries for deleted Views and drops the key when nothing is left', () => {
    const source = config()
    saveViewComponents(source, ['v1'], new Map([['v1', [record()]]]))
    saveViewComponents(source, ['v2'], new Map())

    expect((source.extra as { fuxaSetting: Record<string, unknown> }).fuxaSetting)
      .not.toHaveProperty('viewComponents')
  })

  it('round-trips multi-state and icon-pair definitions', () => {
    const multi = record({
      template: 'icon-multi',
      multiIconSetId: 'set-1',
      normalIconId: 'n',
      multiStateBindings: [
        { stateKey: 'high', iconId: 'i1', tagId: 't1', shapeId: 's1' },
        { stateKey: 'low', iconId: 'i2', tagId: 't2', shapeId: 's2' },
      ],
    })
    const pair = record({
      key: 'loaded-2',
      seq: 2,
      shapeId: 'shape-2',
      labelId: 'label-2',
      template: 'icon-pair',
      normalIconId: 'n',
      alarmIconId: 'a',
      alarmShapeId: 'alarm-2',
      invertIconState: true,
    })
    const source = config()
    saveViewComponents(source, ['v1'], new Map([['v1', [multi, pair]]]))

    const stored = getStoredViewComponents(source, 'v1')!
    expect(stored.invalidCount).toBe(0)
    expect(stored.components).toHaveLength(2)
    expect(stored.components[0]).toMatchObject({ multiStateBindings: multi.multiStateBindings })
    expect(stored.components[1]).toMatchObject({ alarmShapeId: 'alarm-2', invertIconState: true })
  })

  it('skips malformed and duplicate entries and reports their count', () => {
    const valid = normalizeStoredComponent(record())
    const source = config({
      fuxaSetting: {
        viewComponents: {
          v1: [valid, valid, { shapeId: 'x' }, 'nope', { ...valid, template: 'unknown' }],
        },
      },
    })

    const stored = getStoredViewComponents(source, 'v1')!
    expect(stored.components).toHaveLength(1)
    expect(stored.invalidCount).toBe(4)
  })

  it('refuses to save a component with an incomplete definition', () => {
    expect(() => saveViewComponents(
      config(),
      ['v1'],
      new Map([['v1', [record({ shapeId: '' })]]]),
    )).toThrow('定義不完整')
  })
})

describe('reconcileManagedComponents', () => {
  it('uses the SVG result unchanged for legacy files without stored definitions', () => {
    const derived = [record()]
    const result = reconcileManagedComponents(undefined, derived, tagsExist)
    expect(result.components).toEqual(derived)
    expect(result.needsRebuild).toBe(false)
    expect(result.pruned).toEqual([])
  })

  it('does not require a rebuild when the SVG matches the stored definition', () => {
    const derived = record({ iconId: undefined, invertIconState: undefined })
    const stored = { components: [normalizeStoredComponent(derived)!], invalidCount: 0 }
    const result = reconcileManagedComponents(stored, [derived], tagsExist)
    expect(result.needsRebuild).toBe(false)
    expect(result.components).toHaveLength(1)
  })

  it('prefers the stored definition and requests a rebuild when the SVG differs', () => {
    const stored = {
      components: [normalizeStoredComponent(record({ template: 'switch', label: 'Fan' }))!],
      invalidCount: 0,
    }
    const result = reconcileManagedComponents(stored, [record()], tagsExist)
    expect(result.components[0]).toMatchObject({ template: 'switch', label: 'Fan', managed: true })
    expect(result.needsRebuild).toBe(true)
  })

  it('keeps a stored component that is missing from the SVG', () => {
    const stored = { components: [normalizeStoredComponent(record())!], invalidCount: 0 }
    const result = reconcileManagedComponents(stored, [], tagsExist)
    expect(result.components).toHaveLength(1)
    expect(result.components[0]?.key).toBe('loaded-1')
    expect(result.needsRebuild).toBe(true)
    expect(result.original.map((item) => item.shapeId)).toEqual(['shape-1'])
  })

  it('keeps SVG-only components that have no stored definition', () => {
    const stored = { components: [normalizeStoredComponent(record())!], invalidCount: 0 }
    const extra = record({ key: 'loaded-9', seq: 9, shapeId: 'shape-9', labelId: 'label-9' })
    const result = reconcileManagedComponents(stored, [record(), extra], tagsExist)
    expect(result.components.map((item) => item.shapeId)).toEqual(['shape-1', 'shape-9'])
  })

  it('prunes stored components whose Tag no longer exists but still clears them from the SVG', () => {
    const stored = {
      components: [
        normalizeStoredComponent(record())!,
        normalizeStoredComponent(record({
          seq: 2, tagId: 'gone', label: 'Old', shapeId: 'shape-2', labelId: 'label-2',
        }))!,
      ],
      invalidCount: 0,
    }
    const result = reconcileManagedComponents(stored, [], (tagId) => tagId !== 'gone')

    expect(result.components.map((item) => item.shapeId)).toEqual(['shape-1'])
    expect(result.pruned).toEqual(['Old'])
    expect(result.original.map((item) => item.shapeId)).toContain('shape-2')
    expect(result.needsRebuild).toBe(true)
  })

  it('prunes a multi-state component when any bound Tag is missing', () => {
    const multi = normalizeStoredComponent(record({
      template: 'icon-multi',
      multiIconSetId: 'set',
      multiStateBindings: [
        { stateKey: 'a', iconId: 'i', tagId: 'ok', shapeId: 's1' },
        { stateKey: 'b', iconId: 'i', tagId: 'gone', shapeId: 's2' },
      ],
    }))!
    const result = reconcileManagedComponents(
      { components: [multi], invalidCount: 0 },
      [],
      (tagId) => tagId === 'ok' || tagId === 'tag-1',
    )
    expect(result.components).toEqual([])
    expect(result.pruned).toHaveLength(1)
  })
})
