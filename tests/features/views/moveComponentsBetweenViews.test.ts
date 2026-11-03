import { describe, expect, it } from 'vitest'
import type { ExportViewModel } from '../../../src/domain/config/prepareFuxaConfigExport'
import type { FuxaViewSummary } from '../../../src/domain/config/types'
import {
  findEditableTargetView,
  planComponentsMove,
} from '../../../src/features/views/moveComponentsBetweenViews'

function randomProvider() {
  let counter = 0
  return {
    getRandomValues(bytes: Uint8Array<ArrayBuffer>) {
      counter += 1
      bytes.fill(counter)
      return bytes
    },
  }
}

function model(components: Array<Record<string, unknown>>): ExportViewModel {
  return { components } as unknown as ExportViewModel
}

describe('findEditableTargetView', () => {
  it('returns the first other view that has an editable model', () => {
    const views = [
      { id: 'a', key: 'a', name: 'A' },
      { id: 'b', key: 'b', name: 'B' },
      { id: 'c', key: 'c', name: 'C' },
    ] as FuxaViewSummary[]
    const models = new Map([['a', model([])], ['c', model([])]])

    expect(findEditableTargetView(views, 'a', models)?.id).toBe('c')
    expect(findEditableTargetView(views, 'c', new Map([['c', model([])]]))).toBeUndefined()
  })
})

describe('planComponentsMove', () => {
  const baseInput = {
    modifiedViewIds: new Set<string>(),
    randomValues: randomProvider(),
  }

  it('moves selected managed components, appends them with new seq, and marks both views modified', () => {
    const models = new Map([
      ['src', model([
        { key: 'k1', managed: true, seq: 1 },
        { key: 'k2', managed: true, seq: 2 },
      ])],
      ['dst', model([{ key: 'x', managed: true, seq: 5 }])],
    ])

    const plan = planComponentsMove({
      ...baseInput,
      models,
      sourceViewId: 'src',
      componentKeys: ['k2'],
      targetViewId: 'dst',
    })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.movedCount).toBe(1)
    expect(plan.models.get('src')?.components.map((item) => item.key)).toEqual(['k1'])
    const moved = plan.models.get('dst')?.components[1]
    expect(moved?.key).toMatch(/^moved-/)
    expect(moved?.seq).toBe(6)
    expect([...plan.modifiedViewIds].sort()).toEqual(['dst', 'src'])
    expect(models.get('src')?.components).toHaveLength(2)
  })

  it('rejects unmanaged components and same-view moves', () => {
    const models = new Map([
      ['src', model([{ key: 'k1', managed: false, seq: 1 }])],
      ['dst', model([])],
    ])

    expect(planComponentsMove({
      ...baseInput,
      models,
      sourceViewId: 'src',
      componentKeys: ['k1'],
      targetViewId: 'dst',
    })).toEqual({ ok: false, error: '部分選取項目已不存在或不是可移動的受管理元件。' })

    expect(planComponentsMove({
      ...baseInput,
      models,
      sourceViewId: 'src',
      componentKeys: ['k1'],
      targetViewId: 'src',
    })).toEqual({ ok: false, error: '來源或目標 View 不可編輯，無法移動元件。' })
  })
})
