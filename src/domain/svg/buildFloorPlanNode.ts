import type { FloorPlanImage } from '../floorPlans/floorPlanLibrary'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

export const FLOOR_PLAN_ATTRIBUTE = 'data-fuxa-floor-plan'
// FUXA 往返可能遺失 data-* 標記，id 較穩定，作為第二個辨識依據。
export const FLOOR_PLAN_ID = 'fuxa-floor-plan'

export type FloorPlanSize = { width: number; height: number }

export function buildFloorPlanNode(
  doc: XMLDocument,
  image: FloorPlanImage,
  size: FloorPlanSize,
): Element {
  const node = doc.createElementNS(SVG_NAMESPACE, 'image')
  node.setAttribute(FLOOR_PLAN_ATTRIBUTE, 'true')
  node.setAttribute('id', FLOOR_PLAN_ID)
  node.setAttribute('x', '0')
  node.setAttribute('y', '0')
  node.setAttribute('width', String(size.width))
  node.setAttribute('height', String(size.height))
  node.setAttribute('preserveAspectRatio', 'none')
  node.setAttributeNS(XLINK_NAMESPACE, 'xlink:href', image.dataUrl)
  return node
}
