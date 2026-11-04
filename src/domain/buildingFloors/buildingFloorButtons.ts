import { isRecord } from '../config/validateFuxaConfig'
import type { FuxaConfig } from '../config/types'
import { groupBuildingFloors, parseBuildingFloorName } from './buildingFloors'
import type { BuildingFloor } from './buildingFloors'
import { findSvgLayer } from '../svg/findSvgLayer'
import { findSvgElementById, parseSvg } from '../svg/parseSvg'
import type { SvgParserConstructor } from '../svg/parseSvg'

export const BUILDING_FLOOR_BUTTON_NAME = 'fuxa_building_floor_button'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
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
  const views: BuildingFloorViewRecord[] = []
  let hasInvalidView = false
  for (const candidate of config.hmi.views) {
    if (!isRecord(candidate)) continue
    const isFloor = typeof candidate.name === 'string'
      && parseBuildingFloorName(candidate.name) !== null
    const hasManagedButtons = containsManagedButtons(candidate)
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

function appendFloorButtons(
  view: BuildingFloorViewRecord,
  floors: readonly BuildingFloor[],
  floorOrder: readonly BuildingFloor[],
  Parser: SvgParserConstructor,
  serialize: (doc: XMLDocument) => string,
  allocateId: (prefix: string) => string,
): void {
  if (floors.length < 2) return
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
      y: BUTTON_Y,
      x,
      'stroke-width': 0,
    }))
    const foreignObject = createSvgNode(doc, 'foreignObject', {
      id: foreignObjectId,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      y: BUTTON_Y,
      x,
    })
    const htmlButton = doc.createElementNS('http://www.w3.org/1999/xhtml', 'BUTTON')
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
  })

  view.svgcontent = serialize(doc)
}

function adoptExistingFloorButtons(
  view: BuildingFloorViewRecord,
  floors: readonly BuildingFloor[],
  Parser: SvgParserConstructor,
  serialize: (doc: XMLDocument) => string,
): Set<string> {
  const doc = parseSvg(view.svgcontent, Parser)
  const adopted = new Set<string>()
  for (const floor of floors) {
    const candidate = Object.entries(view.items).find(([id, item]) => {
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
        && node.getAttribute('type') === 'svg-ext-html_button'
        && Array.from(node.getElementsByTagName('*')).some(
          (child) => child.localName.toLowerCase() === 'button',
        )
    })
    if (!candidate) continue

    const [id, item] = candidate
    const node = findSvgElementById(doc, id)
    if (!node || !isRecord(item) || !isRecord(item.property)) continue
    node.setAttribute('data-name', BUILDING_FLOOR_BUTTON_NAME)
    node.setAttribute('data-building-floor-target-id', floor.id)
    node.setAttribute('data-building-floor-active', String(floor.id === view.id))
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
    }
    item.name = BUILDING_FLOOR_BUTTON_NAME
    item.property = { ...item.property, text: floor.floorLabel }
    adopted.add(floor.id)
  }
  if (adopted.size) view.svgcontent = serialize(doc)
  return adopted
}

function removeBuildingFloorButtons(
  view: BuildingFloorViewRecord,
  Parser: SvgParserConstructor,
  serialize: (doc: XMLDocument) => string,
): boolean {
  const itemIds = Object.entries(view.items).flatMap(([id, item]) =>
    isRecord(item) && item.name === BUILDING_FLOOR_BUTTON_NAME ? [id] : [],
  )
  let doc: XMLDocument | undefined
  if (itemIds.length || view.svgcontent.includes(BUILDING_FLOOR_BUTTON_NAME)) {
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
    for (const id of new Set([...itemIds, ...managedNodeIds])) {
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
  if (doc && changed) {
    view.svgcontent = serialize(doc)
  }
  return changed
}

function viewHasExpectedButtons(
  view: BuildingFloorViewRecord,
  expectedFloors: readonly BuildingFloor[],
): boolean {
  const entries = Object.entries(view.items).filter(([, item]) =>
    isRecord(item) && item.name === BUILDING_FLOOR_BUTTON_NAME)
  if (entries.length !== expectedFloors.length) return false
  if (!expectedFloors.length) {
    return !view.svgcontent.includes(BUILDING_FLOOR_BUTTON_NAME)
  }
  if ((view.svgcontent.match(
    new RegExp(`data-name="${BUILDING_FLOOR_BUTTON_NAME}"`, 'g'),
  ) ?? []).length !== expectedFloors.length) return false
  if (!expectedFloors.every((expected) => {
    const entry = entries.find(([, item]) => (
      isRecord(item)
      && isRecord(item.property)
      && item.property.text === expected.floorLabel
      && Array.isArray(item.property.events)
      && item.property.events.some((event) => (
        isRecord(event) && event.actparam === expected.id
      ))
    ))
    return entry !== undefined
      && view.svgcontent.includes(
        `data-building-floor-target-id="${expected.id}" data-building-floor-active="${expected.id === view.id}"`,
      )
  })) return false
  return (view.svgcontent.match(/data-building-floor-active="true"/g) ?? []).length === 1
}

export function buildingFloorButtonsNeedSync(config: FuxaConfig): boolean {
  const { views, hasInvalidView } = getBuildingFloorViews(config)
  if (hasInvalidView) return true
  const groups = groupBuildingFloors(views)

  for (const view of views) {
    const parsed = parseBuildingFloorName(view.name)
    const expectedFloors = parsed && (groups.get(parsed.system)?.length ?? 0) > 1
      ? groups.get(parsed.system)!
      : []
    if (!viewHasExpectedButtons(view, expectedFloors)) return true
  }

  return false
}

export function syncBuildingFloorButtons(
  config: FuxaConfig,
  Parser: SvgParserConstructor,
  serialize: (doc: XMLDocument) => string,
  allocateId: (prefix: string) => string,
): Set<string> {
  const { views, hasInvalidView } = getBuildingFloorViews(config)
  if (hasInvalidView) {
    throw new Error('樓層 View 缺少有效的 id、name、svgcontent 或 items，無法同步樓層按鈕。')
  }
  const groups = groupBuildingFloors(views)
  const changedViewIds = new Set<string>()
  for (const view of views) {
    const parsed = parseBuildingFloorName(view.name)
    const floors = parsed && (groups.get(parsed.system)?.length ?? 0) > 1
      ? groups.get(parsed.system)!
      : []
    if (viewHasExpectedButtons(view, floors)) continue
    const changed = removeBuildingFloorButtons(view, Parser, serialize)
    if (changed) changedViewIds.add(view.id)
    if (floors.length < 2) continue
    const adoptedFloors = adoptExistingFloorButtons(view, floors, Parser, serialize)
    const missingFloors = floors.filter((floor) => !adoptedFloors.has(floor.id))
    if (missingFloors.length) {
      appendFloorButtons(view, missingFloors, floors, Parser, serialize, allocateId)
      changedViewIds.add(view.id)
    } else if (adoptedFloors.size) {
      changedViewIds.add(view.id)
    }
  }
  return changedViewIds
}
