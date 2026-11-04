import type { FloorLayoutEntry } from '../../domain/layout/floorLayout'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

export function drawPreviewTagTargets(
  layer: Element,
  placements: readonly FloorLayoutEntry[],
): void {
  for (const { component, placement } of placements) {
    if (component.managed === false) continue

    const { x, y, width, height } = placement.shape
    const doc = layer.ownerDocument
    const target = doc.createElementNS(SVG_NAMESPACE, 'rect')
    target.setAttribute('data-preview-tag-id', component.tagId)
    target.setAttribute('data-preview-tag-label', component.label ?? component.tagId)
    target.setAttribute('x', String(x))
    target.setAttribute('y', String(y))
    target.setAttribute('width', String(width))
    target.setAttribute('height', String(height))
    target.setAttribute('fill', '#000000')
    target.setAttribute('fill-opacity', '0')
    target.setAttribute('pointer-events', 'all')
    target.setAttribute('cursor', 'pointer')
    layer.appendChild(target)
  }
}
