import type { ExportViewModel } from '../../domain/config/prepareFuxaConfigExport'
import type { FuxaViewSummary, ParsedFuxaConfig } from '../../domain/config/types'
import { getErrorMessage } from '../../domain/shared/getErrorMessage'
import { prepareViewPreview, type ViewPreviewRuntime } from './prepareViewPreview'

export interface PreviewState {
  width: number
  height: number
  outsideCanvas?: boolean
  svgMarkup?: string
  error?: string
}

export function createPreviewState(
  config: ParsedFuxaConfig,
  view: FuxaViewSummary,
  models: Map<string, ExportViewModel>,
  runtime: ViewPreviewRuntime,
): PreviewState {
  try {
    return prepareViewPreview(config.rawConfig, view.id, [...models.values()], runtime)
  } catch (error) {
    return {
      width: view.width || 1024,
      height: view.height || 768,
      error: getErrorMessage(error),
    }
  }
}
