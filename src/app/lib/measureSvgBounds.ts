import type { Bounds } from '../../domain/layout/floorLayout'

export function measureSvgBounds(doc: XMLDocument, id: string): Bounds {
  const node = Array.from(doc.getElementsByTagName('*'))
    .find((element) => element.getAttribute('id') === id)
  if (!node) throw new Error('找不到對應的 SVG 元件。')

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const sourceRoot = doc.documentElement
  svg.setAttribute('viewBox', sourceRoot.getAttribute('viewBox') || '0 0 1000 1000')
  svg.setAttribute('preserveAspectRatio', 'none')
  svg.setAttribute('width', '1000')
  svg.setAttribute('height', '1000')
  svg.setAttribute('visibility', 'hidden')
  const clone = node.cloneNode(true) as SVGGraphicsElement
  if (clone.getAttribute('data-fuxa-floor-layout') === 'floor-layout-v1') {
    clone.removeAttribute('transform')
  }
  svg.append(clone)
  document.body.append(svg)
  try {
    const bounds = clone.getBBox()
    if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
        || bounds.width <= 0 || bounds.height <= 0) {
      throw new Error('無法取得有效的 SVG 外框。')
    }
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
  } finally {
    svg.remove()
  }
}
