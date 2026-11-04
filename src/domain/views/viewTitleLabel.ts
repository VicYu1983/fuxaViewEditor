import type { FuxaConfig } from '../config/types'
import { isRecord } from '../config/validateFuxaConfig'
import { getErrorMessage } from '../shared/getErrorMessage'
import { parseSvg } from '../svg/parseSvg'
import type { SvgParserConstructor } from '../svg/parseSvg'
import {
  TOOL_SETTINGS_KEY,
  getToolSettings,
  readToolSettingsForWrite,
} from '../config/toolSettings'

export interface ViewTitleLabelSettings {
  color: string
  fontSize: number
}

export interface UpdateViewTitleLabelResult {
  config: FuxaConfig
  changed: boolean
}

export const DEFAULT_VIEW_TITLE_LABEL: Readonly<ViewTitleLabelSettings> = Object.freeze({
  color: '#000000',
  fontSize: 24,
})

const VIEW_TITLE_LABEL_KEY = 'viewTitleLabel'

export function normalizeViewTitleLabelSettings(value: unknown): ViewTitleLabelSettings {
  const settings = { ...DEFAULT_VIEW_TITLE_LABEL }
  if (!isRecord(value)) return settings

  if (typeof value.color === 'string' && /^#[\da-f]{6}$/i.test(value.color)) {
    settings.color = value.color.toLowerCase()
  }
  if (typeof value.fontSize === 'number'
      && Number.isFinite(value.fontSize)
      && value.fontSize >= 8
      && value.fontSize <= 72) {
    settings.fontSize = value.fontSize
  }
  return settings
}

export function getViewTitleLabelSettings(
  config: FuxaConfig,
  viewId?: string,
  Parser?: SvgParserConstructor,
): ViewTitleLabelSettings {
  const toolSettings = getToolSettings(config)
  const storedSettings = toolSettings?.[VIEW_TITLE_LABEL_KEY]
  if (isRecord(storedSettings)) return normalizeViewTitleLabelSettings(storedSettings)
  // 舊檔遷移：extra 尚無設定時，才從 SVG 標題讀取樣式
  if (!viewId || !Parser) return { ...DEFAULT_VIEW_TITLE_LABEL }

  const view = config.hmi.views.find(
    (candidate): candidate is Record<string, unknown> =>
      isRecord(candidate) && candidate.id === viewId,
  )
  if (!view || typeof view.svgcontent !== 'string') return { ...DEFAULT_VIEW_TITLE_LABEL }

  let doc: XMLDocument
  try {
    doc = parseSvg(view.svgcontent, Parser)
  } catch (error) {
    const detail = getErrorMessage(error)
    const name = typeof view.name === 'string' && view.name ? view.name : viewId
    throw new Error(`無法讀取 View「${name}」的名稱標籤樣式：${detail}`, { cause: error })
  }
  const labelIds = viewTitleIds(view)
  const title = Array.from(doc.getElementsByTagName('*')).find((node) =>
    node.localName === 'text'
    && (node.getAttribute('data-name') === 'view_title'
      || labelIds.has(node.getAttribute('id') || '')))
  if (!title) return { ...DEFAULT_VIEW_TITLE_LABEL }

  return normalizeViewTitleLabelSettings({
    color: title.getAttribute('fill'),
    fontSize: Number(title.getAttribute('font-size')),
  })
}

function viewTitleIds(view: Record<string, unknown>): Set<string> {
  const ids = new Set<string>()
  if (!isRecord(view.items)) return ids
  for (const [id, item] of Object.entries(view.items)) {
    if (isRecord(item) && item.name === 'view_title') ids.add(id)
  }
  return ids
}

export function updateAllViewTitleLabels(
  source: FuxaConfig,
  value: unknown,
  Parser: SvgParserConstructor,
  serialize: (doc: XMLDocument) => string,
): UpdateViewTitleLabelResult {
  const { extra, toolSettings } = readToolSettingsForWrite(source, '安全保存 View 名稱標籤設定')
  const normalized = normalizeViewTitleLabelSettings(value)
  const storedSettings = toolSettings[VIEW_TITLE_LABEL_KEY]
  const hasStoredSettings = isRecord(storedSettings)
  let changed = !hasStoredSettings
    || JSON.stringify(normalizeViewTitleLabelSettings(storedSettings))
      !== JSON.stringify(normalized)
  const config = structuredClone(source)

  for (const view of config.hmi.views) {
    if (!isRecord(view) || typeof view.svgcontent !== 'string') continue
    const labelIds = viewTitleIds(view)
    let doc: XMLDocument
    try {
      doc = parseSvg(view.svgcontent, Parser)
    } catch (error) {
      const detail = getErrorMessage(error)
      const name = typeof view.name === 'string' && view.name ? view.name : String(view.id || '未知 View')
      throw new Error(`無法更新 View「${name}」的名稱標籤：${detail}`, { cause: error })
    }
    let viewChanged = false
    for (const node of Array.from(doc.getElementsByTagName('*'))) {
      if (node.localName !== 'text'
          || (node.getAttribute('data-name') !== 'view_title'
            && !labelIds.has(node.getAttribute('id') || ''))) continue
      if (node.getAttribute('fill') !== normalized.color) {
        node.setAttribute('fill', normalized.color)
        viewChanged = true
      }
      if (node.getAttribute('font-size') !== String(normalized.fontSize)) {
        node.setAttribute('font-size', String(normalized.fontSize))
        viewChanged = true
      }
    }
    if (viewChanged) {
      view.svgcontent = serialize(doc)
      changed = true
    }
  }

  if (!changed) return { config: source, changed: false }
  config.extra = {
    ...extra,
    [TOOL_SETTINGS_KEY]: {
      ...toolSettings,
      [VIEW_TITLE_LABEL_KEY]: normalized,
    },
  }
  return { config, changed: true }
}
