// @vitest-environment jsdom
// Phase 4：Tag 元件定義以 extra 為唯一來源（docs/EXTRA_SOURCE_OF_TRUTH.md）。
import { describe, expect, it } from 'vitest'
import {
  exportText,
  loadModels,
  readFixture,
  removeManagedComponent,
} from '../helpers/fuxaRoundTrip'

const DEMO2 = {
  floor2: 'v_e1747cfd-3c64ddbd',
  floor3: 'v_18f0b8d6-c9165808',
}

interface Output {
  devices: Record<string, { tags?: Record<string, unknown> }>
  hmi: { views: Array<{ id: string; svgcontent: string; items: Record<string, { name?: string }> }> }
  extra?: { fuxaSetting?: { version?: number; viewComponents?: Record<string, Array<{ tagId: string; seq: number }>> } }
}

function parse(text: string): Output {
  return JSON.parse(text) as Output
}

function managedNames(text: string, viewId: string): string[] {
  const view = parse(text).hmi.views.find((candidate) => candidate.id === viewId)!
  return Object.values(view.items)
    .map((item) => item.name ?? '')
    .filter((name) => /^tc_\d+$/.test(name))
    .sort()
}

describe('Tag components stored in extra', () => {
  const source = readFixture('floor-demo2.json')

  it('saves the definitions of managed components and writes the current version', () => {
    const output = parse(exportText(source))
    const stored = output.extra?.fuxaSetting?.viewComponents?.[DEMO2.floor2]

    expect(stored?.map((component) => component.seq)).toEqual([1, 2, 3])
    expect(output.extra?.fuxaSetting?.version).toBeGreaterThanOrEqual(2)
    expect(output.extra?.fuxaSetting?.viewComponents).not.toHaveProperty(DEMO2.floor3)
  })

  it('does not request a rebuild for a freshly exported file', () => {
    const { models } = loadModels(exportText(source))
    for (const model of models.values()) expect(model.componentsNeedRebuild).toBe(false)
  })

  it('does not request a rebuild after every View was re-applied', () => {
    const { models } = loadModels(exportText(source, { modifyAll: true }))
    for (const [viewId, model] of models) {
      expect(model.componentsNeedRebuild, viewId).toBe(false)
    }
  })

  it('INV-1：FUXA 弄丟元件後，匯出時由 extra 重建，且 id 與原本相同', () => {
    const first = exportText(source)
    const before = parse(first).hmi.views.find((view) => view.id === DEMO2.floor2)!
    const lostId = Object.entries(before.items).find(([, item]) => item.name === 'tc_2')![0]

    const damaged = removeManagedComponent(first, DEMO2.floor2, 'tc_2')
    expect(managedNames(damaged, DEMO2.floor2)).toEqual(['tc_1', 'tc_3'])

    const restored = exportText(damaged)
    expect(managedNames(restored, DEMO2.floor2)).toEqual(['tc_1', 'tc_2', 'tc_3'])
    const after = parse(restored).hmi.views.find((view) => view.id === DEMO2.floor2)!
    expect(after.items[lostId]?.name).toBe('tc_2')
    expect(after.svgcontent).toContain(`id="${lostId}"`)
    expect(parse(restored).extra?.fuxaSetting?.viewComponents?.[DEMO2.floor2]).toHaveLength(3)
  })

  it('INV-2：重建後再次匯出，樓層 View 的 SVG 與 items 不再變動', () => {
    const restored = exportText(removeManagedComponent(exportText(source), DEMO2.floor2, 'tc_2'))
    const again = exportText(restored)
    const pick = (text: string) => parse(text).hmi.views
      .filter((view) => [DEMO2.floor2, DEMO2.floor3].includes(view.id))
      .map(({ id, svgcontent, items }) => ({ id, svgcontent, items }))
    expect(pick(again)).toEqual(pick(restored))
  })

  it('does not show a component FUXA lost as an existing Tag candidate', () => {
    const damaged = removeManagedComponent(exportText(source), DEMO2.floor2, 'tc_2')
    const model = loadModels(damaged).models.get(DEMO2.floor2)!

    expect(model.components.filter((component) => component.managed !== false)).toHaveLength(3)
    expect(model.components.filter((component) => component.managed === false)).toHaveLength(0)
    expect(model.componentsNeedRebuild).toBe(true)
  })

  it('removes components whose Tag no longer exists and reports a warning', () => {
    const first = parse(exportText(source))
    const removedTagId = first.extra!.fuxaSetting!.viewComponents![DEMO2.floor2]![0]!.tagId
    for (const device of Object.values(first.devices)) {
      if (device.tags) delete device.tags[removedTagId]
    }
    const text = JSON.stringify(first)

    const loaded = loadModels(text)
    expect(loaded.warnings.get(DEMO2.floor2)?.[0]).toContain('Tag 已不存在')
    expect(loaded.models.get(DEMO2.floor2)!.components.filter(
      (component) => component.managed !== false,
    )).toHaveLength(2)

    const exported = exportText(text)
    expect(managedNames(exported, DEMO2.floor2)).toEqual(['tc_2', 'tc_3'])
    expect(parse(exported).extra?.fuxaSetting?.viewComponents?.[DEMO2.floor2])
      .toHaveLength(2)
  })

  it('migrates a real project: re-applying every View keeps the components stable', () => {
    const project = readFixture('real-components.json')
    const legacy = loadModels(project).models
    const count = (models: ReturnType<typeof loadModels>['models']) => [...models.values()]
      .map((model) => model.components.filter((component) => component.managed !== false).length)

    const withComponents = [...legacy]
      .filter(([, model]) => model.components.some((component) => component.managed !== false))
      .map(([viewId]) => viewId)
    const migrated = exportText(project, { modifyViewIds: withComponents })
    const reloaded = loadModels(migrated).models

    expect(count(reloaded)).toEqual(count(legacy))
    for (const [viewId, model] of reloaded) expect(model.componentsNeedRebuild, viewId).toBe(false)
    expect(count(legacy).some((value) => value > 0)).toBe(true)
  })

  it('keeps reading legacy files without stored definitions from the SVG', () => {
    const legacy = parse(source)
    expect(legacy.extra?.fuxaSetting?.viewComponents).toBeUndefined()
    const model = loadModels(source).models.get(DEMO2.floor2)!

    expect(model.components.filter((component) => component.managed !== false)).toHaveLength(3)
    expect(model.componentsNeedRebuild).toBe(false)
  })
})
