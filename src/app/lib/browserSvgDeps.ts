import type { ViewPreviewRuntime } from '../../features/preview/prepareViewPreview'

export function createBrowserSvgDeps(): ViewPreviewRuntime {
  return {
    Parser: DOMParser,
    serialize: (doc) => new XMLSerializer().serializeToString(doc),
    crypto: window.crypto,
  }
}
