import type { ExportViewModel } from '../../domain/config/prepareFuxaConfigExport'
import type { FuxaConfig } from '../../domain/config/types'
import { getFloorGroupFrameSettings } from '../../domain/layout/floorGroupFrame'
import { DEFAULT_GRID } from '../../domain/layout/gridSettings'

export function createEmptyViewModel(raw: FuxaConfig, viewId: string): ExportViewModel {
  return {
    viewId,
    components: [],
    originalComponents: [],
    grid: { ...DEFAULT_GRID },
    floorGroupFrame: getFloorGroupFrameSettings(raw),
    floorTitles: {},
    floorTitleIds: {},
    floorFrames: {},
    floorFrameIds: {},
    floorFrameShapeIds: {},
  }
}
