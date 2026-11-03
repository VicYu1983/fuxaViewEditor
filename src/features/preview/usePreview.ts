import { useEffect, useState } from 'react'
import type { ExportViewModel } from '../../domain/config/prepareFuxaConfigExport'
import type { FuxaViewSummary, ParsedFuxaConfig } from '../../domain/config/types'
import { getErrorMessage } from '../../domain/shared/getErrorMessage'
import { prepareViewPreview } from './prepareViewPreview'

export interface PreviewState {
  width: number
  height: number
  outsideCanvas?: boolean
  svgMarkup?: string
  error?: string
}

interface PreviewSnapshot {
  result: PreviewState
  config: ParsedFuxaConfig
  models: Map<string, ExportViewModel>
  viewId: string
}

export function createPreviewState(
  config: ParsedFuxaConfig,
  view: FuxaViewSummary,
  models: Map<string, ExportViewModel>,
): PreviewState {
  try {
    return prepareViewPreview(config.rawConfig, view.id, [...models.values()], {
      Parser: DOMParser,
      serialize: (doc) => new XMLSerializer().serializeToString(doc),
      crypto: window.crypto,
    })
  } catch (error) {
    return {
      width: view.width || 1024,
      height: view.height || 768,
      error: getErrorMessage(error),
    }
  }
}

export interface UsePreviewOptions {
  config: ParsedFuxaConfig | null
  models: Map<string, ExportViewModel>
  selectedView: FuxaViewSummary | undefined
}

export interface UsePreviewResult {
  preview: PreviewState | null
  realtime: boolean
  setRealtime: (realtime: boolean) => void
  stale: boolean
  refresh: () => void
}

export function usePreview({ config, models, selectedView }: UsePreviewOptions): UsePreviewResult {
  const [realtime, setRealtime] = useState(true)
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null)

  const preview = snapshot && selectedView && snapshot.viewId === selectedView.id
    ? snapshot.result
    : null
  const stale = !config || !selectedView
    ? false
    : !snapshot
      || snapshot.config !== config
      || snapshot.models !== models
      || snapshot.viewId !== selectedView.id

  useEffect(() => {
    if (!realtime || !config || !selectedView) return
    const timeout = window.setTimeout(() => {
      setSnapshot({
        result: createPreviewState(config, selectedView, models),
        config,
        models,
        viewId: selectedView.id,
      })
    }, 180)
    return () => window.clearTimeout(timeout)
  }, [config, models, realtime, selectedView])

  function refresh() {
    if (!config || !selectedView) return
    setSnapshot({
      result: createPreviewState(config, selectedView, models),
      config,
      models,
      viewId: selectedView.id,
    })
  }

  return { preview, realtime, setRealtime, stale, refresh }
}
