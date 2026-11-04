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

    const labelText = component.label ?? component.tagId
    const labelWidth = Math.max(24, labelText.length * 8)
    const { x: labelX, y: labelY, anchor } = placement.label
    const labelLeft = anchor === 'middle' ? labelX - labelWidth / 2
      : anchor === 'end' ? labelX - labelWidth
        : labelX
    const labelTarget = doc.createElementNS(SVG_NAMESPACE, 'rect')
    labelTarget.setAttribute('data-preview-tag-id', component.tagId)
    labelTarget.setAttribute('data-preview-tag-label', labelText)
    labelTarget.setAttribute('x', String(labelLeft))
    labelTarget.setAttribute('y', String(labelY - 14))
    labelTarget.setAttribute('width', String(labelWidth))
    labelTarget.setAttribute('height', '18')
    labelTarget.setAttribute('fill', '#000000')
    labelTarget.setAttribute('fill-opacity', '0')
    labelTarget.setAttribute('pointer-events', 'all')
    labelTarget.setAttribute('cursor', 'pointer')
    layer.appendChild(labelTarget)
  }
}
