import { isRecord } from '../../domain/shared/isRecord'
import { findSvgElementById, parseSvg, type SvgParserConstructor } from '../../domain/svg/parseSvg'

export interface ViewTitleRuntime {
  Parser: SvgParserConstructor
  serialize: (doc: XMLDocument) => string
}

export function syncViewTitleText(
  view: { items?: unknown; svgcontent?: unknown },
  name: string,
  runtime: ViewTitleRuntime,
): void {
  const titleEntry = Object.entries(isRecord(view.items) ? view.items : {})
    .find(([, item]) => isRecord(item) && item.name === 'view_title')
  if (!titleEntry || typeof view.svgcontent !== 'string') return
  const doc = parseSvg(view.svgcontent, runtime.Parser)
  const titleNode = findSvgElementById(doc, titleEntry[0])
  if (!titleNode) return
  titleNode.textContent = name
  view.svgcontent = runtime.serialize(doc)
}
