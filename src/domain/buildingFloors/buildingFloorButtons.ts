import { isRecord } from '../config/validateFuxaConfig'
import type { FuxaConfig } from '../config/types'
import { groupBuildingFloors, parseBuildingFloorName } from './buildingFloors'
import type { BuildingFloor } from './buildingFloors'
import { findSvgLayer } from '../svg/findSvgLayer'
import { TOOL_SETTINGS_KEY, readToolSettingsForWrite } from '../config/toolSettings'
import { findSvgElementById, parseSvg } from '../svg/parseSvg'
import type { SvgParserConstructor } from '../svg/parseSvg'

// 樓層按鈕由 extra.fuxaSetting.buildingFloorButtons 與 View 清單決定，SVG 每次重建。
// 設計見 docs/EXTRA_SOURCE_OF_TRUTH.md 第 6 節。

export const BUILDING_FLOOR_BUTTON_NAME = 'fuxa_building_floor_button'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const BUILDING_FLOOR_BUTTONS_KEY = 'buildingFloorButtons'
const BUTTON_ID_PREFIX = 'HXB_'
const BUTTON_WIDTH = 80
const BUTTON_HEIGHT = 32
const BUTTON_GAP = 16
const BUTTON_X = 42
const BUTTON_Y = 19
const POSITION_TOLERANCE = 0.01
const CURRENT_BUTTON_COLOR = '#1d4ed8'

interface BuildingFloorViewRecord extends Record<string, unknown> {
  id: string
  name: string
  svgcontent: string
  items: Record<string, unknown>
}

type BuildingFloorButtonIndex = Record<string, Record<string, string>>

function getBuildingFloorButtonIndex(config: FuxaConfig): BuildingFloorButtonIndex {
  const { toolSettings } = readToolSettingsForWrite(config, '安全保存樓層按鈕索引')
  const index = toolSettings[BUILDING_FLOOR_BUTTONS_KEY]
  if (index === undefined) return {}
  if (!isRecord(index)) {
    throw new Error(
      `配置的 extra.${TOOL_SETTINGS_KEY}.${BUILDING_FLOOR_BUTTONS_KEY} 欄位格式無效。`,
    )
  }

  const normalized: BuildingFloorButtonIndex = {}
  for (const [viewId, targetIds] of Object.entries(index)) {
    if (!isRecord(targetIds)
        || Object.values(targetIds).some((id) => typeof id !== 'string' || !id)) {
      throw new Error(`View「${viewId}」的樓層按鈕索引格式無效。`)
    }
    normalized[viewId] = targetIds as Record<string, string>
  }
  return normalized
}

function saveBuildingFloorButtonIndex(
  config: FuxaConfig,
  index: BuildingFloorButtonIndex,
): void {
  const { extra, toolSettings } = readToolSettingsForWrite(config, '安全保存樓層按鈕索引')
  config.extra = {
    ...extra,
    [TOOL_SETTINGS_KEY]: {
      ...toolSettings,
      [BUILDING_FLOOR_BUTTONS_KEY]: index,
    },
  }
}

function isBuildingFloorView(value: unknown): value is BuildingFloorViewRecord {
  return isRecord(value)
    && typeof value.id === 'string'
    && Boolean(value.id)
    && typeof value.name === 'string'
    && typeof value.svgcontent === 'string'
    && isRecord(value.items)
}

function hasManagedItems(items: unknown): boolean {
  return isRecord(items)
    && Object.values(items).some((item) =>
      isRecord(item) && item.name === BUILDING_FLOOR_BUTTON_NAME)
}

function getBuildingFloorViews(config: FuxaConfig): {
  views: BuildingFloorViewRecord[]
  hasInvalidView: boolean
} {
  const buttonIndex = getBuildingFloorButtonIndex(config)
  const views: BuildingFloorViewRecord[] = []
  let hasInvalidView = false
  for (const candidate of config.hmi.views) {
    if (!isRecord(candidate)) continue
    const isFloor = typeof candidate.name === 'string'
      && parseBuildingFloorName(candidate.name) !== null
    // 舊版寫入的 data-name 標記只用於找出需要清除的殘留，不用來判斷狀態
    const hasManagedButtons = hasManagedItems(candidate.items)
      || (typeof candidate.svgcontent === 'string'
        && candidate.svgcontent.includes(BUILDING_FLOOR_BUTTON_NAME))
      || (typeof candidate.id === 'string' && buttonIndex[candidate.id] !== undefined)
    if (!isFloor && !hasManagedButtons) continue
    if (!isBuildingFloorView(candidate)) {
      hasInvalidView = true
      continue
    }
    views.push(candidate)
  }
  return { views, hasInvalidView }
}

function createSvgNode(
  doc: XMLDocument,
  name: string,
  attributes: Record<string, string | number>,
): Element {
  const node = doc.createElementNS(SVG_NAMESPACE, name)
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value))
  }
  return node
}

function buttonEntry(floor: BuildingFloor, id: string): Record<string, unknown> {
  return {
    id,
    type: 'svg-ext-html_button',
    name: BUILDING_FLOOR_BUTTON_NAME,
    property: {
      events: [{
        type: 'click',
        action: 'onpage',
        actparam: floor.id,
        actoptions: {},
      }],
      actions: [],
      text: floor.floorLabel,
      ranges: [{ min: 20, max: 80, color: '', type: 2, stroke: '' }],
    },
    label: 'HtmlButton',
    hide: false,
    lock: false,
  }
}

function buttonStyle(isCurrent: boolean): string {
  return `width:calc(100% - 6px);height:calc(100% - 6px);text-align:center;`
    + `background-color:${isCurrent ? CURRENT_BUTTON_COLOR : '#FFFFFF'};`
    + `color:${isCurrent ? '#FFFFFF' : '#000000'};font-size:14px;font-family:sans-serif;`
}

// 內部元素的 id 由外層 id 決定，重建結果因此可重複。FUXA 以 `B-HXB_` 前綴尋找按鈕元素。
function innerIds(outerId: string): { rect: string; foreignObject: string; button: string } {
  const suffix = outerId.startsWith(BUTTON_ID_PREFIX)
    ? outerId.slice(BUTTON_ID_PREFIX.length)
    : outerId
  return {
    rect: `svg_${suffix}`,
    foreignObject: `H-HXB_${suffix}`,
    button: `B-HXB_${suffix}`,
  }
}

function buttonX(index: number): number {
  return BUTTON_X + index * (BUTTON_WIDTH + BUTTON_GAP)
}

function buildingFloorButtonY(view: BuildingFloorViewRecord, doc: XMLDocument): number {
  const titleIds = new Set(Object.entries(view.items).flatMap(([id, item]) =>
    isRecord(item) && item.name === 'view_title' ? [id] : [],
  ))
  const titleNodes = Array.from(doc.getElementsByTagName('*')).filter((node) =>
    node.localName === 'text'
    && (node.getAttribute('data-name') === 'view_title'
      || titleIds.has(node.getAttribute('id') ?? '')
      || node.textContent?.trim() === view.name),
  )
  const titleBottoms = titleNodes.flatMap((node) => {
    const baseline = Number(node.getAttribute('y'))
    const fontSize = Number(node.getAttribute('font-size')) || 14
    return Number.isFinite(baseline)
      ? [baseline + Math.max(4, fontSize * 0.25) + BUTTON_GAP / 2]
      : []
  })
  return Math.max(BUTTON_Y, ...titleBottoms)
}

function collectDocumentIds(doc: XMLDocument): Set<string> {
  const ids = new Set<string>()
  for (const node of Array.from(doc.getElementsByTagName('*'))) {
    const id = node.getAttribute('id')
    if (id) ids.add(id)
  }
  return ids
}

// 受管按鈕以 id 識別：items 內 name 為受管名稱者，加上 extra 索引記錄的 id。
// 舊版寫入的 data-name 標記只用於清除殘留。
function collectManagedButtonIds(
  view: BuildingFloorViewRecord,
  indexedButtonIds: Record<string, string>,
  doc?: XMLDocument,
): Set<string> {
  const ids = new Set<string>(Object.values(indexedButtonIds))
  for (const [id, item] of Object.entries(view.items)) {
    if (isRecord(item) && item.name === BUILDING_FLOOR_BUTTON_NAME) ids.add(id)
  }
  if (doc) {
    for (const node of Array.from(doc.getElementsByTagName('*'))) {
      if (node.getAttribute('data-name') !== BUILDING_FLOOR_BUTTON_NAME) continue
      const id = node.getAttribute('id')
      if (id) ids.add(id)
    }
  }
  return ids
}

// 舊版樣板在 FUXA 內手動建立、指向同系統樓層的按鈕：視為受管按鈕的前身，首次同步時取代，避免重複。
function findLegacyButtonIds(
  view: BuildingFloorViewRecord,
  floors: readonly BuildingFloor[],
  managedIds: ReadonlySet<string>,
): Set<string> {
  const ids = new Set<string>()
  for (const [id, item] of Object.entries(view.items)) {
    if (managedIds.has(id)
        || !isRecord(item)
        || item.type !== 'svg-ext-html_button'
        || !isRecord(item.property)) continue
    const property = item.property
    const events = Array.isArray(property.events) ? property.events : []
    const matchesFloor = floors.some((floor) => (
      property.text === floor.floorLabel
      && events.some((event) => (
        isRecord(event) && event.action === 'onpage' && event.actparam === floor.id
      ))
    ))
    if (matchesFloor) ids.add(id)
  }
  return ids
}

function near(value: string | null, expected: number): boolean {
  return value !== null && Math.abs(Number(value) - expected) < POSITION_TOLERANCE
}

function descendantById(node: Element, id: string): Element | undefined {
  return Array.from(node.getElementsByTagName('*')).find(
    (child) => child.getAttribute('id') === id,
  )
}

function geometryMatches(node: Element | undefined, localName: string, x: number, y: number): boolean {
  return node !== undefined
    && node.localName === localName
    && near(node.getAttribute('x'), x)
    && near(node.getAttribute('y'), y)
    && near(node.getAttribute('width'), BUTTON_WIDTH)
    && near(node.getAttribute('height'), BUTTON_HEIGHT)
}

function buttonMatchesSpec(
  view: BuildingFloorViewRecord,
  doc: XMLDocument,
  floor: BuildingFloor,
  outerId: string,
  x: number,
  y: number,
): boolean {
  const item = view.items[outerId]
  if (!isRecord(item)
      || item.type !== 'svg-ext-html_button'
      || item.name !== BUILDING_FLOOR_BUTTON_NAME
      || !isRecord(item.property)
      || item.property.text !== floor.floorLabel
      || !Array.isArray(item.property.events)
      || !item.property.events.some((event) => (
        isRecord(event) && event.action === 'onpage' && event.actparam === floor.id
      ))) return false

  const group = findSvgElementById(doc, outerId)
  if (!group
      || group.localName !== 'g'
      || group.getAttribute('type') !== 'svg-ext-html_button') return false

  const ids = innerIds(outerId)
  if (!geometryMatches(descendantById(group, ids.rect), 'rect', x, y)) return false
  if (!geometryMatches(descendantById(group, ids.foreignObject), 'foreignObject', x, y)) return false

  // FUXA 往返後可能只剩文字；帶命名空間前綴的 BUTTON（例如 html:BUTTON）FUXA 也無法讀取
  const button = descendantById(group, ids.button)
  if (!button || button.localName.toLowerCase() !== 'button' || button.prefix) return false
  if (button.textContent !== floor.floorLabel) return false
  const isCurrent = floor.id === view.id
  return (button.getAttribute('style') ?? '').toLowerCase().includes(CURRENT_BUTTON_COLOR)
    === isCurrent
}

function expectedFloorsFor(
  view: BuildingFloorViewRecord,
  groups: ReturnType<typeof groupBuildingFloors>,
): readonly BuildingFloor[] {
  const parsed = parseBuildingFloorName(view.name)
  return parsed && (groups.get(parsed.system)?.length ?? 0) > 1
    ? groups.get(parsed.system)!
    : []
}

function viewNeedsButtonSync(
  view: BuildingFloorViewRecord,
  floors: readonly BuildingFloor[],
  indexedButtonIds: Record<string, string>,
  Parser: SvgParserConstructor,
): boolean {
  if (floors.length === 0) {
    return Object.keys(indexedButtonIds).length > 0
      || hasManagedItems(view.items)
      || view.svgcontent.includes(BUILDING_FLOOR_BUTTON_NAME)
  }

  const expectedIds = floors.map((floor) => indexedButtonIds[floor.id])
  if (expectedIds.some((id) => !id)
      || Object.keys(indexedButtonIds).length !== floors.length) return true

  const doc = parseSvg(view.svgcontent, Parser)
  const managedIds = collectManagedButtonIds(view, indexedButtonIds, doc)
  if (managedIds.size !== new Set(expectedIds).size
      || !expectedIds.every((id) => id && managedIds.has(id))) return true
  if (findLegacyButtonIds(view, floors, managedIds).size > 0) return true

  const y = buildingFloorButtonY(view, doc)
  return !floors.every((floor, index) => (
    buttonMatchesSpec(view, doc, floor, expectedIds[index]!, buttonX(index), y)
  ))
}

function removeButtons(
  view: BuildingFloorViewRecord,
  doc: XMLDocument,
  ids: ReadonlySet<string>,
): void {
  for (const node of Array.from(doc.getElementsByTagName('*'))) {
    if (node.getAttribute('data-name') === BUILDING_FLOOR_BUTTON_NAME) {
      node.parentNode?.removeChild(node)
    }
  }
  for (const id of ids) {
    const node = findSvgElementById(doc, id)
    node?.parentNode?.removeChild(node)
    delete view.items[id]
  }
}

function appendFloorButtons(
  view: BuildingFloorViewRecord,
  doc: XMLDocument,
  floors: readonly BuildingFloor[],
  previousButtonIds: Record<string, string>,
  buttonY: number,
  allocateId: (prefix: string) => string,
): Record<string, string> {
  const layer = findSvgLayer(doc)
  if (!layer) {
    throw new Error(`View「${view.name}」找不到可安全插入樓層按鈕的 SVG 圖層。`)
  }

  const takenIds = collectDocumentIds(doc)
  for (const id of Object.keys(view.items)) takenIds.add(id)
  const isUsable = (id: string): boolean => (
    ![id, ...Object.values(innerIds(id))].some((candidate) => takenIds.has(candidate))
  )

  const buttonIds: Record<string, string> = {}
  floors.forEach((floor, index) => {
    const previousId = previousButtonIds[floor.id]
    let buttonId = previousId?.startsWith(BUTTON_ID_PREFIX) && isUsable(previousId)
      ? previousId
      : ''
    for (let attempt = 0; !buttonId && attempt < 5; attempt += 1) {
      const candidate = allocateId('HXB')
      if (isUsable(candidate)) buttonId = candidate
    }
    if (!buttonId) throw new Error(`無法為 View「${view.name}」的樓層按鈕產生唯一 ID。`)
    const ids = innerIds(buttonId)
    for (const id of [buttonId, ...Object.values(ids)]) takenIds.add(id)

    const x = buttonX(index)
    const isCurrent = floor.id === view.id
    const button = createSvgNode(doc, 'g', {
      'data-name': BUILDING_FLOOR_BUTTON_NAME,
      'data-building-floor-target-id': floor.id,
      'data-building-floor-active': String(isCurrent),
      id: buttonId,
      stroke: 'rgba(0,0,0,0)',
      fill: 'rgba(0,0,0,0)',
      type: 'svg-ext-html_button',
    })
    button.appendChild(createSvgNode(doc, 'rect', {
      id: ids.rect,
      height: BUTTON_HEIGHT,
      width: BUTTON_WIDTH,
      y: buttonY,
      x,
      'stroke-width': 0,
    }))
    const foreignObject = createSvgNode(doc, 'foreignObject', {
      id: ids.foreignObject,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      y: buttonY,
      x,
    })
    // 必須在 SVG 命名空間內建立，序列化後才不會出現 html: 前綴（FUXA 原生也是無前綴的 BUTTON）
    const htmlButton = doc.createElementNS(SVG_NAMESPACE, 'BUTTON')
    htmlButton.setAttribute('style', buttonStyle(isCurrent))
    htmlButton.setAttribute('class', 'md-btn  md-btn-raised')
    htmlButton.setAttribute('id', ids.button)
    htmlButton.textContent = floor.floorLabel
    foreignObject.appendChild(htmlButton)
    button.appendChild(foreignObject)
    layer.appendChild(button)
    view.items[buttonId] = buttonEntry(floor, buttonId)
    buttonIds[floor.id] = buttonId
  })
  return buttonIds
}

export function buildingFloorButtonsNeedSync(
  config: FuxaConfig,
  Parser: SvgParserConstructor,
): boolean {
  const buttonIndex = getBuildingFloorButtonIndex(config)
  const { views, hasInvalidView } = getBuildingFloorViews(config)
  if (hasInvalidView) return true
  const groups = groupBuildingFloors(views)
  const activeViewIds = new Set(views.map((view) => view.id))
  if (Object.keys(buttonIndex).some((viewId) => !activeViewIds.has(viewId))) return true

  return views.some((view) => viewNeedsButtonSync(
    view,
    expectedFloorsFor(view, groups),
    buttonIndex[view.id] ?? {},
    Parser,
  ))
}

export function syncBuildingFloorButtons(
  config: FuxaConfig,
  Parser: SvgParserConstructor,
  serialize: (doc: XMLDocument) => string,
  allocateId: (prefix: string) => string,
): Set<string> {
  const buttonIndex = getBuildingFloorButtonIndex(config)
  const { views, hasInvalidView } = getBuildingFloorViews(config)
  if (hasInvalidView) {
    throw new Error('樓層 View 缺少有效的 id、name、svgcontent 或 items，無法同步樓層按鈕。')
  }
  const groups = groupBuildingFloors(views)
  const changedViewIds = new Set<string>()
  const nextButtonIndex: BuildingFloorButtonIndex = {}
  for (const view of views) {
    const floors = expectedFloorsFor(view, groups)
    const previousButtonIds = buttonIndex[view.id] ?? {}
    if (!viewNeedsButtonSync(view, floors, previousButtonIds, Parser)) {
      if (floors.length) nextButtonIndex[view.id] = previousButtonIds
      continue
    }

    const doc = parseSvg(view.svgcontent, Parser)
    const managedIds = collectManagedButtonIds(view, previousButtonIds, doc)
    const legacyIds = findLegacyButtonIds(view, floors, managedIds)
    removeButtons(view, doc, new Set([...managedIds, ...legacyIds]))
    if (floors.length) {
      nextButtonIndex[view.id] = appendFloorButtons(
        view,
        doc,
        floors,
        previousButtonIds,
        buildingFloorButtonY(view, doc),
        allocateId,
      )
    }
    view.svgcontent = serialize(doc)
    changedViewIds.add(view.id)
  }
  if (Object.keys(nextButtonIndex).length || Object.keys(buttonIndex).length) {
    saveBuildingFloorButtonIndex(config, nextButtonIndex)
  }
  return changedViewIds
}
