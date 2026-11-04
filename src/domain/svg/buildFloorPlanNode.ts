import type { FloorPlanImage } from '../floorPlans/floorPlanLibrary'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

export const FLOOR_PLAN_ATTRIBUTE = 'data-fuxa-floor-plan'

export function buildFloorPlanNode(doc: XMLDocument, image: FloorPlanImage): Element {
  const node = doc.createElementNS(SVG_NAMESPACE, 'image')
  node.setAttribute(FLOOR_PLAN_ATTRIBUTE, 'true')
  node.setAttribute('x', '0')
  node.setAttribute('y', '0')
  node.setAttribute('width', String(image.width))
  node.setAttribute('height', String(image.height))
  node.setAttributeNS(XLINK_NAMESPACE, 'xlink:href', image.dataUrl)
  return node
}
