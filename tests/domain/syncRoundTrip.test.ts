// @vitest-environment jsdom
// Phase 0 特徵測試：記錄目前 JSON 同步行為，作為 docs/EXTRA_SOURCE_OF_TRUTH.md 重構的安全網。
// `it.fails` 代表「已知缺口」：目前行為不符合不變量，修好後該測試會失敗，需改為一般 `it`。
import { describe, expect, it } from 'vitest'
import {
  exportText,
  readFixture,
  simulateFuxaRoundTrip,
  summarizeFloorButtons,
} from '../helpers/fuxaRoundTrip'

const DEMO = {
  main: 'v_01313641395-13849',
  floor2: 'v_61312041081-10064',
  floor3: 'v_28b5410a9-1335a',
}
const DEMO2 = {
  main: 'v_11060410b1-811212',
  floor2: 'v_e1747cfd-3c64ddbd',
  floor3: 'v_18f0b8d6-c9165808',
}

interface ParsedView {
  id: string
  name: string
  svgcontent: string
  items: Record<string, { name?: string }>
}

function parse(text: string): {
  hmi: { views: ParsedView[] }
  extra?: { fuxaSetting?: Record<string, unknown>; [key: string]: unknown }
} {
  return JSON.parse(text)
}

function viewOf(text: string, id: string): ParsedView {
  const view = parse(text).hmi.views.find((candidate) => candidate.id === id)
  if (!view) throw new Error(`找不到 View ${id}`)
  return view
}

function expectHealthyFloorButtons(text: string, floor2Id: string, floor3Id: string): void {
  const summary = summarizeFloorButtons(text)
  for (const [viewId, label] of [[floor2Id, '2F'], [floor3Id, '3F']] as const) {
    const view = summary[viewId]!
    expect(view.buttons.map((button) => button.text), `${label} 按鈕文字`).toEqual(['2F', '3F'])
    expect(view.buttons.map((button) => button.target).sort(), `${label} 目標`)
      .toEqual([floor2Id, floor3Id].sort())
    expect(view.buttons.every((button) => button.hasGroup), `${label} 的 <g> 存在`).toBe(true)
    expect(view.buttonElementCount, `${label} 的 <BUTTON> 數量`).toBe(2)
    expect(view.buttonElementIds, `${label} 的 B-HXB_ id`).toHaveLength(2)
  }
}

describe('sync round trip (characterization)', () => {
  describe('floor-demo.json（FUXA 內建立的按鈕，尚無 extra）', () => {
    const source = readFixture('floor-demo.json')

    it('INV-7：匯出後每個樓層 View 都有完整按鈕', () => {
      expectHealthyFloorButtons(exportText(source), DEMO.floor2, DEMO.floor3)
    })

    it('INV-6：匯出文字不含 namespace 前綴的 BUTTON', () => {
      const text = exportText(source)
      expect(text).not.toMatch(/html:BUTTON/i)
      expect(text).not.toContain('<html:')
    })

    it('INV-9：extra 內的按鈕索引只指向存在的 View', () => {
      const output = parse(exportText(source))
      const viewIds = new Set(output.hmi.views.map((view) => view.id))
      const index = output.extra?.fuxaSetting?.buildingFloorButtons as Record<string, Record<string, string>>
      expect(Object.keys(index).sort()).toEqual([DEMO.floor2, DEMO.floor3].sort())
      for (const [viewId, targets] of Object.entries(index)) {
        expect(viewIds.has(viewId)).toBe(true)
        for (const targetId of Object.keys(targets)) expect(viewIds.has(targetId)).toBe(true)
      }
    })

    it('INV-4：沒有樓層的 MainView 原樣保留', () => {
      const before = viewOf(source, DEMO.main)
      const after = viewOf(exportText(source), DEMO.main)
      expect(after.svgcontent).toBe(before.svgcontent)
      expect(after.items).toEqual(before.items)
    })

    it('INV-2：再次匯出，按鈕 id 與位置不變', () => {
      const first = exportText(source)
      expect(summarizeFloorButtons(exportText(first))).toEqual(summarizeFloorButtons(first))
    })
  })

  describe('floor-demo2.json（FUXA 往返後 2F 按鈕只剩文字）', () => {
    const source = readFixture('floor-demo2.json')

    it('載入時的壞狀態：2F 沒有 <BUTTON>，3F 完整', () => {
      const summary = summarizeFloorButtons(source)
      expect(summary[DEMO2.floor2]!.buttonElementCount).toBe(0)
      expect(summary[DEMO2.floor3]!.buttonElementCount).toBe(2)
    })

    it('INV-7：匯出後兩個樓層 View 都有完整按鈕', () => {
      expectHealthyFloorButtons(exportText(source), DEMO2.floor2, DEMO2.floor3)
    })

    it('INV-6：匯出文字不含 namespace 前綴的 BUTTON', () => {
      const text = exportText(source)
      expect(text).not.toMatch(/html:BUTTON/i)
      expect(text).not.toContain('<html:')
    })

    it('INV-5：extra 與 fuxaSetting 內未知的鍵原樣保留', () => {
      const config = parse(source)
      config.extra = {
        ...config.extra,
        otherTool: { keep: true },
        fuxaSetting: { ...config.extra?.fuxaSetting, futureKey: { a: 1 } },
      }
      const output = parse(exportText(JSON.stringify(config)))
      expect(output.extra).toMatchObject({ otherTool: { keep: true } })
      expect(output.extra?.fuxaSetting).toMatchObject({ futureKey: { a: 1 } })
    })

    it('INV-12：平面圖設定與 Tag 偏移原樣保留', () => {
      const before = parse(source).extra?.fuxaSetting
      const after = parse(exportText(source)).extra?.fuxaSetting
      expect(after?.floorPlanViewIds).toEqual(before?.floorPlanViewIds)
      expect(after?.floorPlanTagOffsets).toEqual(before?.floorPlanTagOffsets)
    })

    it('INV-4：不屬於受管元件的 items 原樣保留', () => {
      const managed = new Set(['fuxa_building_floor_button', 'fuxa_floor_section_title'])
      for (const id of [DEMO2.floor2, DEMO2.floor3]) {
        const strip = (items: ParsedView['items']) => Object.fromEntries(
          Object.entries(items).filter(([, item]) => !managed.has(String(item.name))),
        )
        expect(strip(viewOf(exportText(source), id).items)).toEqual(strip(viewOf(source, id).items))
      }
    })

    it('INV-8：平面圖 View 不殘留群組標題與底框（SVG 與 items）', () => {
      const view = viewOf(exportText(source), DEMO2.floor2)
      const names = Object.values(view.items).map((item) => item.name)
      expect(names).not.toContain('fuxa_floor_section_title')
      expect(names).not.toContain('fuxa_floor_section_frame')
      expect(view.svgcontent).not.toContain('fuxa_floor_section')
      expect(view.svgcontent).not.toContain('未設定樓層')
      expect(names).toContain('view_title')
    })

    it('INV-8：群組標題清除後，樓層設定與 floorGroupArtifacts 不再指向該 View 的標題', () => {
      const artifacts = parse(exportText(source)).extra?.fuxaSetting?.floorGroupArtifacts as
        Record<string, Record<string, unknown>>
      expect(artifacts[DEMO2.floor2]).toEqual({})
    })
  })

  describe('simulateFuxaRoundTrip', () => {
    const source = readFixture('floor-demo2.json')

    it('INV-3：FUXA 遺失按鈕標記後再匯出，按鈕仍完整且 id 不變', () => {
      const first = exportText(source)
      const second = exportText(simulateFuxaRoundTrip(first))
      expectHealthyFloorButtons(second, DEMO2.floor2, DEMO2.floor3)
      expect(summarizeFloorButtons(second)).toEqual(summarizeFloorButtons(first))
    })

    it('INV-3：FUXA 連 <BUTTON> 一併遺失後再匯出，按鈕會重建', () => {
      const first = exportText(source)
      const damaged = simulateFuxaRoundTrip(first, { dropButtonElements: true })
      expect(summarizeFloorButtons(damaged)[DEMO2.floor3]!.buttonElementCount).toBe(0)
      expectHealthyFloorButtons(exportText(damaged), DEMO2.floor2, DEMO2.floor3)
    })

    it.fails('INV-3（已知缺口，Phase 2）：<BUTTON> 遺失後重建，按鈕 id 與第一次匯出相同', () => {
      const first = exportText(source)
      const second = exportText(simulateFuxaRoundTrip(first, { dropButtonElements: true }))
      expect(summarizeFloorButtons(second)).toEqual(summarizeFloorButtons(first))
    })
  })
})
