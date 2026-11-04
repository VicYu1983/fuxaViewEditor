import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseFuxaConfig } from '../../src/domain/config/parseFuxaConfig'
import { prepareFuxaConfigExport } from '../../src/domain/config/prepareFuxaConfigExport'
import { createFuxaConfigExportDependencies } from '../../src/domain/config/fuxaConfigExportDependencies'
import { buildViewEditorModels } from '../../src/domain/views/buildViewEditorModels'
import { buildTagIndex } from '../../src/domain/tags/index'
import { BUILDING_FLOOR_BUTTON_NAME } from '../../src/domain/buildingFloors/buildingFloorButtons'

// 測試環境需為 jsdom（DOMParser、XMLSerializer 由全域提供）；測試從專案根目錄執行。

export function readFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), 'tests', 'fixtures', name), 'utf8')
}

export interface ExportTextOptions {
  /** 視為所有 View 都被使用者修改過（強制重新套用每個 View）。 */
  modifyAll?: boolean
  /** 視為只有這些 View 被使用者修改過。 */
  modifyViewIds?: readonly string[]
}

/**
 * 模擬使用者載入後不做任何編輯就匯出（dirty 但沒有已修改的 View），
 * 與 App 在「樓層按鈕需要同步」時的路徑相同。
 */
export function exportText(text: string, options: ExportTextOptions = {}): string {
  const parsed = parseFuxaConfig(text)
  const { models } = buildViewEditorModels(parsed.rawConfig, DOMParser, () => {
    throw new Error('jsdom 無法量測 SVG 邊界')
  })
  const dependencies = createFuxaConfigExportDependencies(parsed.rawConfig, {
    Parser: DOMParser,
    serialize: (doc) => new XMLSerializer().serializeToString(doc),
    crypto: globalThis.crypto,
  })
  return prepareFuxaConfigExport({
    config: parsed.rawConfig,
    originalText: parsed.originalText,
    sourceFormat: parsed.sourceFormat,
    dirty: true,
    models: [...models.values()],
    modifiedViewIds: options.modifyAll
      ? new Set(models.keys())
      : new Set(options.modifyViewIds ?? []),
    tags: buildTagIndex(parsed.rawConfig),
  }, dependencies).text
}

/** 以與匯出相同的方式載入編輯模型（jsdom 無法量測既有元件，會被略過）。 */
export function loadModels(text: string) {
  return buildViewEditorModels(parseFuxaConfig(text).rawConfig, DOMParser, () => {
    throw new Error('jsdom 無法量測 SVG 邊界')
  })
}

/**
 * 模擬 FUXA 弄丟某個受管 Tag 元件：從 SVG 與 items 移除該元件（名稱為 tc_N）及其 label、alarm 等附屬項目。
 */
export function removeManagedComponent(text: string, viewId: string, name: string): string {
  const config = JSON.parse(text) as { hmi: { views: Array<Record<string, unknown>> } }
  const view = config.hmi.views.find((candidate) => candidate.id === viewId)
  if (!view) throw new Error(`找不到 View ${viewId}`)
  const items = view.items as Record<string, { name?: string }>
  const ids = Object.entries(items)
    .filter(([, item]) => item.name === name || item.name?.startsWith(`${name}_`))
    .map(([id]) => id)
  if (ids.length === 0) throw new Error(`View ${viewId} 沒有元件 ${name}`)

  const doc = new DOMParser().parseFromString(String(view.svgcontent), 'image/svg+xml')
  for (const id of ids) {
    const node = Array.from(doc.getElementsByTagName('*'))
      .find((element) => element.getAttribute('id') === id)
    node?.parentNode?.removeChild(node)
    delete items[id]
  }
  view.svgcontent = new XMLSerializer().serializeToString(doc)
  return JSON.stringify(config, null, 4)
}

export interface FuxaRoundTripOptions {
  /** 移除樓層按鈕內的 `<BUTTON>`，只留下文字（2F 在 demo2 的狀態）。 */
  dropButtonElements?: boolean
}

const DROPPED_BUTTON_ATTRIBUTES = [
  'data-name',
  'data-building-floor-target-id',
  'data-building-floor-active',
]

/**
 * 依 docs/EXTRA_SOURCE_OF_TRUTH.md 3.3 的觀察模擬 FUXA 往返：
 * 樓層按鈕 `<g>` 遺失 data-name 與 data-building-floor-*，根 `<svg>` 多出 xmlns 宣告，
 * 可選擇連 `<BUTTON>` 一併遺失。其他內容不動。
 */
export function simulateFuxaRoundTrip(
  text: string,
  options: FuxaRoundTripOptions = {},
): string {
  const config = JSON.parse(text) as { hmi: { views: Array<Record<string, unknown>> } }
  for (const view of config.hmi.views) {
    if (typeof view.svgcontent !== 'string') continue
    let svg = view.svgcontent
    svg = svg.replace(/<g\b[^>]*type="svg-ext-html_button"[^>]*>/g, (tag) => {
      let result = tag
      for (const attribute of DROPPED_BUTTON_ATTRIBUTES) {
        result = result.replace(new RegExp(`\\s${attribute}="[^"]*"`, 'g'), '')
      }
      return result
    })
    if (options.dropButtonElements) {
      svg = svg.replace(/<BUTTON\b[^>]*>([\s\S]*?)<\/BUTTON>/gi, '$1')
    }
    svg = svg.replace(/<svg\b([^>]*)>/, (_tag, attributes: string) => {
      let result = attributes
      if (!result.includes('xmlns:svg=')) result += ' xmlns:svg="http://www.w3.org/2000/svg"'
      if (!result.includes('xmlns:html=')) result += ' xmlns:html="http://www.w3.org/1999/xhtml"'
      return `<svg${result}>`
    })
    view.svgcontent = svg
  }
  return JSON.stringify(config, null, 4)
}

export interface FloorButtonSummary {
  itemId: string
  text: string
  target: string
  /** SVG 內以該 id 為 `<g>` 的節點是否存在。 */
  hasGroup: boolean
}

export interface ViewFloorButtonSummary {
  viewName: string
  buttons: FloorButtonSummary[]
  /** SVG 內 `<BUTTON>` 元素數量（不分大小寫，含帶前綴的寫法）。 */
  buttonElementCount: number
  /** SVG 內 id 以 `B-HXB_` 開頭的元素 id。 */
  buttonElementIds: string[]
}

export function summarizeFloorButtons(text: string): Record<string, ViewFloorButtonSummary> {
  const config = JSON.parse(text) as { hmi: { views: Array<Record<string, unknown>> } }
  const summary: Record<string, ViewFloorButtonSummary> = {}
  for (const view of config.hmi.views) {
    const id = String(view.id)
    const svg = typeof view.svgcontent === 'string' ? view.svgcontent : ''
    const items = (view.items ?? {}) as Record<string, Record<string, unknown>>
    const buttons: FloorButtonSummary[] = Object.entries(items)
      .filter(([, item]) => item.name === BUILDING_FLOOR_BUTTON_NAME)
      .map(([itemId, item]) => {
        const property = (item.property ?? {}) as Record<string, unknown>
        const events = Array.isArray(property.events)
          ? property.events as Array<Record<string, unknown>>
          : []
        return {
          itemId,
          text: String(property.text ?? ''),
          target: String(events[0]?.actparam ?? ''),
          hasGroup: new RegExp(`<g\\b[^>]*\\bid="${itemId}"`).test(svg),
        }
      })
      .sort((left, right) => left.text.localeCompare(right.text))
    summary[id] = {
      viewName: String(view.name),
      buttons,
      buttonElementCount: (svg.match(/<(?:[\w-]+:)?BUTTON\b/gi) ?? []).length,
      buttonElementIds: [...svg.matchAll(/\bid="(B-HXB_[^"]+)"/g)].map((match) => match[1] ?? ''),
    }
  }
  return summary
}
