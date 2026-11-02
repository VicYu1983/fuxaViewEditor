import type { FuxaConfig } from '../config/types'
import { isRecord } from '../config/validateFuxaConfig'
import { generateId } from '../ids'
import type { RandomValuesProvider } from '../ids'
import { parseSvg } from '../svg/parseSvg'
import type { SvgParserConstructor } from '../svg/parseSvg'
import { getViewTitleLabelSettings } from './viewTitleLabel'

export interface SiteNameLabelRuntime {
  Parser: SvgParserConstructor
  serialize: (doc: XMLDocument) => string
  crypto: RandomValuesProvider
}

export interface UpdateSiteNameLabelResult {
  config: FuxaConfig
  changed: boolean
}

const TOOL_SETTINGS_KEY = 'fuxaSetting'
const SITE_NAME_LABEL_KEY = 'siteNameLabel'
const SITE_NAME_LABEL_NAME = 'site_name'
const SVG_NS = 'http://www.w3.org/2000/svg'
const LABEL_MARGIN = 20

export interface SiteNameLabelSettings {
  name: string
  color: string
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
}

export type SiteNameLabelStyle = Omit<SiteNameLabelSettings, 'name'>

export function getSiteNameSettings(config: FuxaConfig): SiteNameLabelSettings {
  const toolSettings = isRecord(config.extra) && isRecord(config.extra[TOOL_SETTINGS_KEY])
    ? config.extra[TOOL_SETTINGS_KEY]
    : undefined
  const stored = toolSettings?.[SITE_NAME_LABEL_KEY]
  const record = isRecord(stored) ? stored : {}
  const title = getViewTitleLabelSettings(config)
  return {
    name: typeof record.name === 'string' ? record.name : '',
    color: typeof record.color === 'string' && /^#[\da-f]{6}$/i.test(record.color)
      ? record.color.toLowerCase()
      : title.color,
    fontSize: typeof record.fontSize === 'number'
      && Number.isFinite(record.fontSize)
      && record.fontSize >= 8
      && record.fontSize <= 72
      ? record.fontSize
      : title.fontSize,
    bold: record.bold === true,
    italic: record.italic === true,
    underline: record.underline === true,
  }
}

export function getSiteName(config: FuxaConfig): string {
  return getSiteNameSettings(config).name
}

function siteLabelIds(view: Record<string, unknown>): Set<string> {
  const ids = new Set<string>()
  if (!isRecord(view.items)) return ids
  for (const [id, item] of Object.entries(view.items)) {
    if (isRecord(item) && item.name === SITE_NAME_LABEL_NAME) ids.add(id)
  }
  return ids
}

function isSiteLabelNode(node: Element, ids: Set<string>): boolean {
  return node.localName === 'text'
    && (node.getAttribute('data-name') === SITE_NAME_LABEL_NAME
      || ids.has(node.getAttribute('id') || ''))
}

function profileSize(view: Record<string, unknown>, doc: XMLDocument): { width: number; height: number } {
  const profile = isRecord(view.profile) ? view.profile : {}
  const root = doc.documentElement
  const width = typeof profile.width === 'number' && profile.width > 0
    ? profile.width
    : Number.parseFloat(root.getAttribute('width') || '') || 1024
  const height = typeof profile.height === 'number' && profile.height > 0
    ? profile.height
    : Number.parseFloat(root.getAttribute('height') || '') || 768
  return { width, height }
}

// Adds, updates or removes the single site name label of a view; never creates a duplicate.
export function upsertSiteNameLabel(
  view: Record<string, unknown>,
  name: string,
  style: SiteNameLabelStyle,
  usedIds: Set<string>,
  runtime: SiteNameLabelRuntime,
): boolean {
  if (typeof view.svgcontent !== 'string') return false
  const doc = parseSvg(view.svgcontent, runtime.Parser)
  const ids = siteLabelIds(view)
  const labels = Array.from(doc.getElementsByTagName('*')).filter((node) => isSiteLabelNode(node, ids))
  let changed = false

  if (!name) {
    if (!labels.length && !ids.size) return false
    for (const label of labels) label.parentNode?.removeChild(label)
    if (isRecord(view.items)) for (const id of ids) delete view.items[id]
    view.svgcontent = runtime.serialize(doc)
    return true
  }

  const { width, height } = profileSize(view, doc)
  const attributes: Record<string, string> = {
    x: String(width - LABEL_MARGIN),
    y: String(height - LABEL_MARGIN),
    fill: style.color,
    stroke: style.color,
    'stroke-width': '0',
    'font-size': String(style.fontSize),
    'font-weight': style.bold ? 'bold' : 'normal',
    'font-style': style.italic ? 'italic' : 'normal',
    'text-decoration': style.underline ? 'underline' : 'none',
    'text-anchor': 'end',
  }

  let label = labels[0]
  for (const extraLabel of labels.slice(1)) {
    extraLabel.parentNode?.removeChild(extraLabel)
    changed = true
  }
  if (!label) {
    const id = generateId('svg', usedIds, runtime.crypto)
    const parent = doc.getElementsByTagName('g')[0] ?? doc.documentElement
    label = doc.createElementNS(SVG_NS, 'text')
    label.setAttribute('id', id)
    label.setAttribute('data-name', SITE_NAME_LABEL_NAME)
    label.setAttribute('font-family', 'sans-serif')
    label.setAttribute('xml:space', 'preserve')
    parent.appendChild(label)
    if (!isRecord(view.items)) view.items = {}
    ;(view.items as Record<string, unknown>)[id] = {
      id,
      type: 'svg-ext-shapes-text',
      name: SITE_NAME_LABEL_NAME,
      property: null,
      label: 'Shapes',
      hide: false,
      lock: false,
    }
    changed = true
  } else if (isRecord(view.items)) {
    const id = label.getAttribute('id') || ''
    if (id && !ids.has(id)) {
      view.items[id] = {
        id,
        type: 'svg-ext-shapes-text',
        name: SITE_NAME_LABEL_NAME,
        property: null,
        label: 'Shapes',
        hide: false,
        lock: false,
      }
      changed = true
    }
  }

  for (const [key, value] of Object.entries(attributes)) {
    if (label.getAttribute(key) !== value) {
      label.setAttribute(key, value)
      changed = true
    }
  }
  if (label.textContent !== name) {
    label.textContent = name
    changed = true
  }
  if (changed) view.svgcontent = runtime.serialize(doc)
  return changed
}

export function updateAllSiteNameLabels(
  source: FuxaConfig,
  input: Partial<SiteNameLabelSettings>,
  runtime: SiteNameLabelRuntime,
): UpdateSiteNameLabelResult {
  if (source.extra !== undefined && !isRecord(source.extra)) {
    throw new Error('配置的 extra 欄位不是物件，無法安全保存案場名稱設定。')
  }
  const extra = isRecord(source.extra) ? source.extra : {}
  const currentToolSettings = extra[TOOL_SETTINGS_KEY]
  if (currentToolSettings !== undefined && !isRecord(currentToolSettings)) {
    throw new Error(`配置的 extra.${TOOL_SETTINGS_KEY} 欄位不是物件，無法安全保存案場名稱設定。`)
  }
  const toolSettings = isRecord(currentToolSettings) ? currentToolSettings : {}
  const current = getSiteNameSettings(source)
  const merged = { ...current, ...input }
  const settings: SiteNameLabelSettings = {
    name: String(merged.name ?? '').trim(),
    color: /^#[\da-f]{6}$/i.test(merged.color) ? merged.color.toLowerCase() : current.color,
    fontSize: Number.isFinite(merged.fontSize)
      ? Math.min(72, Math.max(8, merged.fontSize))
      : current.fontSize,
    bold: merged.bold === true,
    italic: merged.italic === true,
    underline: merged.underline === true,
  }
  const name = settings.name
  const stored = toolSettings[SITE_NAME_LABEL_KEY]
  let changed = !isRecord(stored)
    || JSON.stringify(stored) !== JSON.stringify(settings)
  const config = structuredClone(source)
  const usedIds = collectConfigIds(config, runtime.Parser)
  const style: SiteNameLabelStyle = settings

  for (const view of config.hmi.views) {
    if (!isRecord(view)) continue
    try {
      if (upsertSiteNameLabel(view, name, style, usedIds, runtime)) changed = true
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      const viewName = typeof view.name === 'string' && view.name ? view.name : String(view.id || '未知 View')
      throw new Error(`無法更新 View「${viewName}」的案場名稱標籤：${detail}`, { cause: error })
    }
  }

  if (!changed) return { config: source, changed: false }
  config.extra = {
    ...extra,
    [TOOL_SETTINGS_KEY]: {
      ...toolSettings,
      [SITE_NAME_LABEL_KEY]: settings,
    },
  }
  return { config, changed: true }
}

function collectConfigIds(config: FuxaConfig, Parser: SvgParserConstructor): Set<string> {
  const ids = new Set<string>()
  for (const view of config.hmi.views) {
    if (!isRecord(view)) continue
    if (typeof view.id === 'string') ids.add(view.id)
    if (isRecord(view.items)) for (const id of Object.keys(view.items)) ids.add(id)
    if (typeof view.svgcontent !== 'string' || !view.svgcontent.trim()) continue
    const doc = parseSvg(view.svgcontent, Parser)
    for (const element of Array.from(doc.getElementsByTagName('*'))) {
      const id = element.getAttribute('id')
      if (id) ids.add(id)
    }
  }
  return ids
}
