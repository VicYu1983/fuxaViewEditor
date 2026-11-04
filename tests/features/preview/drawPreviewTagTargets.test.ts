import { describe, expect, it } from 'vitest'
import { layoutFloorComponents } from '../../../src/domain/layout/floorLayout'
import { drawPreviewTagTargets } from '../../../src/features/preview/drawPreviewTagTargets'

class TestElement {
  readonly attributes: Record<string, string> = {}
  readonly children: TestElement[] = []
  readonly localName: string
  readonly ownerDocument: TestDocument

  constructor(localName: string, ownerDocument: TestDocument) {
    this.localName = localName
    this.ownerDocument = ownerDocument
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value
  }

  appendChild(child: TestElement): TestElement {
    this.children.push(child)
    return child
  }
}

class TestDocument {
  createElementNS(_namespace: string, name: string): TestElement {
    return new TestElement(name, this)
  }
}

describe('drawPreviewTagTargets', () => {
  it('draws a transparent clickable target per managed tag', () => {
    const layout = layoutFloorComponents([
      { key: 'tag-a', tagId: 'tag-1', template: 'rect', label: 'Pump A' },
      { key: 'tag-b', tagId: 'tag-2', template: 'rect', managed: false },
    ], { columns: 2, originX: 20, originY: 30 }, new Map())
    const doc = new TestDocument()
    const layer = new TestElement('g', doc)

    drawPreviewTagTargets(layer as unknown as Element, layout.placements)

    expect(layer.children).toHaveLength(2)
    const target = layer.children[0]!
    const shape = layout.placements[0]!.placement.shape
    expect(target.localName).toBe('rect')
    expect(target.attributes).toMatchObject({
      'data-preview-tag-id': 'tag-1',
      'data-preview-tag-label': 'Pump A',
      x: String(shape.x),
      y: String(shape.y),
      width: String(shape.width),
      height: String(shape.height),
      'fill-opacity': '0',
      'pointer-events': 'all',
    })
    const labelTarget = layer.children[1]!
    expect(labelTarget.attributes).toMatchObject({
      'data-preview-tag-id': 'tag-1',
      'data-preview-tag-label': 'Pump A',
      'pointer-events': 'all',
    })
  })
})
