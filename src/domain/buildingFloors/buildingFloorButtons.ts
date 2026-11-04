import { isRecord } from '../config/validateFuxaConfig'
import type { FuxaConfig } from '../config/types'
import { groupBuildingFloors, parseBuildingFloorName } from './buildingFloors'
import type { BuildingFloor } from './buildingFloors'
import { findSvgLayer } from '../svg/findSvgLayer'
import { findSvgElementById, parseSvg } from '../svg/parseSvg'
import type { SvgParserConstructor } from '../svg/parseSvg'

export const BUILDING_FLOOR_BUTTON_NAME = 'fuxa_building_floor_button'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const TOOL_SETTINGS_KEY = 'fuxaSetting'
const BUILDING_FLOOR_BUTTONS_KEY = 'buildingFloorButtons'
const BUTTON_WIDTH = 80
const BUTTON_HEIGHT = 32
const BUTTON_GAP = 16
const BUTTON_X = 42
const BUTTON_Y = 19

interface BuildingFloorViewRecord extends Record<string, unknown> {
  id: string
  name: string
  svgcontent: string
  items: Record<string, unknown>
}

type BuildingFloorButtonIndex = Record<string, Record<string, string>>

function getBuildingFloorButtonIndex(config: FuxaConfig): BuildingFloorButtonIndex {
  if (config.extra !== undefined && !isRecord(config.extra)) {
    throw new Error('配置的 extra 欄位不是物件，無法安全保存樓層按鈕索引。')
  }
  const toolSettings = isRecord(config.extra) ? config.extra[TOOL_SETTINGS_KEY] : undefined
  if (toolSettings !== undefined && !isRecord(toolSettings)) {
    throw new Error(`配置的 extra.${TOOL_SETTINGS_KEY} 欄位不是物件，無法安全保存樓層按鈕索引。`)
  }
  const index = isRecord(toolSettings) ? toolSettings[BUILDING_FLOOR_BUTTONS_KEY] : undefined
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
  const extra = isRecord(config.extra) ? config.extra : {}
  const toolSettings = isRecord(extra[TOOL_SETTINGS_KEY]) ? extra[TOOL_SETTINGS_KEY] : {}
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

function containsManagedButtons(value: Record<string, unknown>): boolean {
  const hasManagedItem = isRecord(value.items)
    && Object.values(value.items).some((item) =>
      isRecord(item) && item.name === BUILDING_FLOOR_BUTTON_NAME)
  return hasManagedItem
    || (typeof value.svgcontent === 'string'
      && value.svgcontent.includes(BUILDING_FLOOR_BUTTON_NAME))
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
    const hasManagedButtons = containsManagedButtons(candidate)
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

function appendFloorButtons(
  view: BuildingFloorViewRecord,
  floors: readonly BuildingFloor[],
  floorOrder: readonly BuildingFloor[],
  buttonY: number,
  Parser: SvgParserConstructor,
  serialize: (doc: XMLDocument) => string,
  allocateId: (prefix: string) => string,
): Record<string, string> {
  const buttonIds: Record<string, string> = {}
  if (floors.length === 0) return buttonIds
  const doc = parseSvg(view.svgcontent, Parser)
  const layer = findSvgLayer(doc)
  if (!layer) {
    throw new Error(`View「${view.name}」找不到可安全插入樓層按鈕的 SVG 圖層。`)
  }

  floors.forEach((floor) => {
    const buttonId = allocateId('HXB')
    const rectId = allocateId('svg')
    const foreignObjectId = allocateId('H-HXB')
    const htmlButtonId = allocateId('B-HXB')
    const x = BUTTON_X + floorOrder.indexOf(floor) * (BUTTON_WIDTH + BUTTON_GAP)
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
      id: rectId,
      height: BUTTON_HEIGHT,
      width: BUTTON_WIDTH,
      y: buttonY,
      x,
      'stroke-width': 0,
    }))
    const foreignObject = createSvgNode(doc, 'foreignObject', {
      id: foreignObjectId,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      y: buttonY,
      x,
    })
    const htmlButton = doc.createElementNS(SVG_NAMESPACE, 'BUTTON')
    htmlButton.setAttribute(
      'style',
      `width:calc(100% - 6px);height:calc(100% - 6px);text-align:center;`
        + `background-color:${isCurrent ? '#1d4ed8' : '#FFFFFF'};`
        + `color:${isCurrent ? '#FFFFFF' : '#000000'};font-size:14px;font-family:sans-serif;`,
    )
    htmlButton.setAttribute('class', 'md-btn  md-btn-raised')
    htmlButton.setAttribute('id', htmlButtonId)
    htmlButton.textContent = floor.floorLabel
    foreignObject.appendChild(htmlButton)
    button.appendChild(foreignObject)
    layer.appendChild(button)
    view.items[buttonId] = buttonEntry(floor, buttonId)
    buttonIds[floor.id] = buttonId
  })

  view.svgcontent = serialize(doc)
  return buttonIds
}

function adoptExistingFloorButtons(
  view: BuildingFloorViewRecord,
  floors: readonly BuildingFloor[],
  indexedButtonIds: Record<string, string>,
  buttonY: number,
  Parser: SvgParserConstructor,
  serialize: (doc: XMLDocument) => string,
): Record<string, string> {
  const doc = parseSvg(view.svgcontent, Parser)
  const adopted: Record<string, string> = {}
  for (const floor of floors) {
    const indexedId = indexedButtonIds[floor.id]
    const indexedItem = indexedId ? view.items[indexedId] : undefined
    const indexedNode = indexedId ? findSvgElementById(doc, indexedId) : null
    const indexedHasButton = indexedNode && Array.from(indexedNode.getElementsByTagName('*'))
      .some((child) => child.localName.toLowerCase() === 'button')
    const candidate = indexedId && isRecord(indexedItem)
      && indexedItem.type === 'svg-ext-html_button'
      && indexedNode
      && indexedNode.localName === 'g'
      && indexedHasButton
      ? [indexedId, indexedItem] as const
      : Object.entries(view.items).find(([id, item]) => {
        if (!isRecord(item)
            || item.type !== 'svg-ext-html_button'
            || !isRecord(item.property)
            || item.property.text !== floor.floorLabel
            || !Array.isArray(item.property.events)
            || !item.property.events.some((event) => (
              isRecord(event)
              && event.action === 'onpage'
              && event.actparam === floor.id
            ))) return false
        const node = findSvgElementById(doc, id)
        return node?.localName === 'g'
          && Array.from(node.getElementsByTagName('*')).some(
            (child) => child.localName.toLowerCase() === 'button',
          )
      })
    if (!candidate) continue

    const [id, item] = candidate
    if (!id) continue
    const node = findSvgElementById(doc, id)
    if (!node || !isRecord(item)) continue
    node.setAttribute('type', 'svg-ext-html_button')
    node.setAttribute('data-name', BUILDING_FLOOR_BUTTON_NAME)
    node.setAttribute('data-building-floor-target-id', floor.id)
    node.setAttribute('data-building-floor-active', String(floor.id === view.id))
    const x = BUTTON_X + floors.indexOf(floor) * (BUTTON_WIDTH + BUTTON_GAP)
    const rect = Array.from(node.getElementsByTagName('*')).find(
      (child) => child.localName === 'rect',
    )
    if (rect) {
      rect.setAttribute('width', String(BUTTON_WIDTH))
      rect.setAttribute('height', String(BUTTON_HEIGHT))
      rect.setAttribute('x', String(x))
      rect.setAttribute('y', String(buttonY))
    }
    const foreignObject = Array.from(node.getElementsByTagName('*')).find(
      (child) => child.localName === 'foreignObject',
    )
    if (foreignObject) {
      foreignObject.setAttribute('width', String(BUTTON_WIDTH))
      foreignObject.setAttribute('height', String(BUTTON_HEIGHT))
      foreignObject.setAttribute('x', String(x))
      foreignObject.setAttribute('y', String(buttonY))
    }
    const htmlButton = Array.from(node.getElementsByTagName('*')).find(
      (child) => child.localName.toLowerCase() === 'button',
    )
    if (htmlButton) {
      const isCurrent = floor.id === view.id
      htmlButton.setAttribute(
        'style',
        `width:calc(100% - 6px);height:calc(100% - 6px);text-align:center;`
          + `background-color:${isCurrent ? '#1d4ed8' : '#FFFFFF'};`
          + `color:${isCurrent ? '#FFFFFF' : '#000000'};font-size:14px;font-family:sans-serif;`,
      )
      htmlButton.textContent = floor.floorLabel
    }
    item.name = BUILDING_FLOOR_BUTTON_NAME
    const property = isRecord(item.property) ? item.property : {}
    item.property = {
      ...property,
      events: [{
        type: 'click',
        action: 'onpage',
        actparam: floor.id,
        actoptions: {},
      }],
      text: floor.floorLabel,
    }
    adopted[floor.id] = id
  }
  if (Object.keys(adopted).length) view.svgcontent = serialize(doc)
  return adopted
}

function removeBuildingFloorButtons(
  view: BuildingFloorViewRecord,
  indexedButtonIds: Record<string, string>,
  Parser: SvgParserConstructor,
  serialize: (doc: XMLDocument) => string,
): boolean {
  const itemIds = Object.entries(view.items).flatMap(([id, item]) =>
    isRecord(item) && item.name === BUILDING_FLOOR_BUTTON_NAME ? [id] : [],
  )
  const indexedIds = Object.values(indexedButtonIds)
  let doc: XMLDocument | undefined
  if (itemIds.length || indexedIds.length || view.svgcontent.includes(BUILDING_FLOOR_BUTTON_NAME)) {
    doc = parseSvg(view.svgcontent, Parser)
  }

  let changed = false
  if (doc) {
    const managedNodeIds: string[] = []
    for (const node of Array.from(doc.getElementsByTagName('*'))) {
      if (node.getAttribute('data-name') === BUILDING_FLOOR_BUTTON_NAME) {
        const id = node.getAttribute('id')
        if (id) managedNodeIds.push(id)
        node.parentNode?.removeChild(node)
        changed = true
      }
    }
    for (const id of new Set([...itemIds, ...indexedIds, ...managedNodeIds])) {
      const node = findSvgElementById(doc, id)
      node?.parentNode?.removeChild(node)
      if (view.items[id]) {
        delete view.items[id]
        changed = true
      }
    }
  }
  for (const id of itemIds) {
    delete view.items[id]
    changed = true
  }
  for (const id of indexedIds) {
    if (view.items[id]) {
      delete view.items[id]
      changed = true
    }
  }
  if (doc && changed) {
    view.svgcontent = serialize(doc)
  }
  return changed
}

function viewHasExpectedButtons(
  view: BuildingFloorViewRecord,
  expectedFloors: readonly BuildingFloor[],
  indexedButtonIds: Record<string, string>,
): boolean {
  if (Object.keys(indexedButtonIds).length !== expectedFloors.length) return false
  const entries = Object.entries(view.items).filter(([, item]) =>
    isRecord(item) && item.name === BUILDING_FLOOR_BUTTON_NAME)
  if (entries.length !== expectedFloors.length) return false
  if (!expectedFloors.length) {
    return !view.svgcontent.includes(BUILDING_FLOOR_BUTTON_NAME)
      && Object.keys(indexedButtonIds).length === 0
  }
  if ((view.svgcontent.match(
    new RegExp(`data-name="${BUILDING_FLOOR_BUTTON_NAME}"`, 'g'),
  ) ?? []).length !== expectedFloors.length) return false
  if ((view.svgcontent.match(/<button\b/gi) ?? []).length !== expectedFloors.length) return false
  if (!expectedFloors.every((expected) => {
    const indexedId = indexedButtonIds[expected.id]
    const entry = entries.find(([id, item]) => (
      id === indexedId
      && isRecord(item)
      && item.type === 'svg-ext-html_button'
      && isRecord(item.property)
      && item.property.text === expected.floorLabel
      && Array.isArray(item.property.events)
      && item.property.events.some((event) => (
        isRecord(event) && event.actparam === expected.id
      ))
    ))
    return Boolean(indexedId)
      && entry !== undefined
      && view.svgcontent.includes(
        `data-building-floor-target-id="${expected.id}" data-building-floor-active="${expected.id === view.id}"`,
      )
  })) return false
  return (view.svgcontent.match(/data-building-floor-active="true"/g) ?? []).length === 1
}

function buttonPositionsMatch(
  view: BuildingFloorViewRecord,
  floors: readonly BuildingFloor[],
  indexedButtonIds: Record<string, string>,
  Parser: SvgParserConstructor,
): boolean {
  const doc = parseSvg(view.svgcontent, Parser)
  const buttonY = buildingFloorButtonY(view, doc)
  return floors.every((floor, index) => {
    const id = indexedButtonIds[floor.id]
    const node = id ? findSvgElementById(doc, id) : null
    if (!node) return false
    const rect = Array.from(node.getElementsByTagName('*')).find(
      (child) => child.localName === 'rect',
    )
    const foreignObject = Array.from(node.getElementsByTagName('*')).find(
      (child) => child.localName === 'foreignObject',
    )
    const expectedX = BUTTON_X + index * (BUTTON_WIDTH + BUTTON_GAP)
    return Number(rect?.getAttribute('x')) === expectedX
      && Number(rect?.getAttribute('y')) === buttonY
      && Number(foreignObject?.getAttribute('x')) === expectedX
      && Number(foreignObject?.getAttribute('y')) === buttonY
  })
}

export function buildingFloorButtonsNeedSync(config: FuxaConfig): boolean {
  const buttonIndex = getBuildingFloorButtonIndex(config)
  const { views, hasInvalidView } = getBuildingFloorViews(config)
  if (hasInvalidView) return true
  const groups = groupBuildingFloors(views)
  const activeViewIds = new Set(views.map((view) => view.id))
  if (Object.keys(buttonIndex).some((viewId) => !activeViewIds.has(viewId))) return true

  for (const view of views) {
    const parsed = parseBuildingFloorName(view.name)
    const expectedFloors = parsed && (groups.get(parsed.system)?.length ?? 0) > 1
      ? groups.get(parsed.system)!
      : []
    if (!viewHasExpectedButtons(view, expectedFloors, buttonIndex[view.id] ?? {})) return true
  }

  return false
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
    const parsed = parseBuildingFloorName(view.name)
    const floors = parsed && (groups.get(parsed.system)?.length ?? 0) > 1
      ? groups.get(parsed.system)!
      : []
    const previousButtonIds = buttonIndex[view.id] ?? {}
    if (viewHasExpectedButtons(view, floors, previousButtonIds)) {
      if (floors.length === 0
          || buttonPositionsMatch(view, floors, previousButtonIds, Parser)) {
        if (floors.length) nextButtonIndex[view.id] = previousButtonIds
        continue
      }
    }

    if (!floors.length) {
      if (removeBuildingFloorButtons(view, previousButtonIds, Parser, serialize)) {
        changedViewIds.add(view.id)
      }
      continue
    }

    const doc = parseSvg(view.svgcontent, Parser)
    const buttonY = buildingFloorButtonY(view, doc)
    const adoptedButtonIds = adoptExistingFloorButtons(
      view,
      floors,
      previousButtonIds,
      buttonY,
      Parser,
      serialize,
    )
    if (viewHasExpectedButtons(view, floors, adoptedButtonIds)) {
      nextButtonIndex[view.id] = adoptedButtonIds
      changedViewIds.add(view.id)
      continue
    }

    removeBuildingFloorButtons(view, previousButtonIds, Parser, serialize)
    const createdButtonIds = appendFloorButtons(
      view,
      floors,
      floors,
      buttonY,
      Parser,
      serialize,
      allocateId,
    )
    nextButtonIndex[view.id] = createdButtonIds
    changedViewIds.add(view.id)
  }
  if (Object.keys(nextButtonIndex).length || Object.keys(buttonIndex).length) {
    saveBuildingFloorButtonIndex(config, nextButtonIndex)
  }
  return changedViewIds
}
