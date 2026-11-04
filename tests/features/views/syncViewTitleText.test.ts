import { describe, expect, it } from 'vitest'
import type { SvgParser } from '../../../src/domain/svg/parseSvg'
import { syncViewTitleText } from '../../../src/features/views/syncViewTitleText'

interface FakeNode {
  id: string
  textContent: string | null
  getAttribute(name: string): string | null
}

function fakeParser(source: string): XMLDocument {
  const ids = Array.from(source.matchAll(/\bid="([^"]+)"/g), (match) => match[1]!)
  const elements: FakeNode[] = ids.map((id) => ({
    id,
    textContent: 'old',
    getAttribute(name: string) {
      return name === 'id' ? id : null
    },
  }))
  const root = {
    localName: 'svg',
    getAttribute: () => null,
  }
  return {
    documentElement: root,
    getElementsByTagName(name: string) {
      if (name === 'parsererror') return []
      if (name === '*') return [root, ...elements]
      return []
    },
    __elements: elements,
  } as unknown as XMLDocument
}

class TestParser implements SvgParser {
  parseFromString(source: string): XMLDocument {
    return fakeParser(source)
  }
}

const runtime = {
  Parser: TestParser,
  serialize: (doc: XMLDocument) => {
    const elements = (doc as unknown as { __elements: FakeNode[] }).__elements
    return elements.map((element) => `${element.id}:${element.textContent}`).join('|')
  },
}

describe('syncViewTitleText', () => {
  it('updates the view_title element text and writes back the serialized SVG', () => {
    const view = {
      items: { title_1: { name: 'view_title' }, other: { name: 'shape' } },
      svgcontent: '<svg><text id="title_1">old</text><rect id="other"/></svg>',
    }

    syncViewTitleText(view, 'NewName', runtime)

    expect(view.svgcontent).toBe('title_1:NewName|other:old')
  })

  it('leaves the view unchanged when there is no view_title item', () => {
    const original = '<svg><rect id="other"/></svg>'
    const view = { items: { other: { name: 'shape' } }, svgcontent: original }

    syncViewTitleText(view, 'NewName', runtime)

    expect(view.svgcontent).toBe(original)
  })

  it('leaves the view unchanged when svgcontent is not a string', () => {
    const view = { items: { title_1: { name: 'view_title' } }, svgcontent: undefined }

    syncViewTitleText(view, 'NewName', runtime)

    expect(view.svgcontent).toBeUndefined()
  })
})
