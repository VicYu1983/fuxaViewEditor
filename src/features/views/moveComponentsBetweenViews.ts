import type { ExportViewModel } from '../../domain/config/prepareFuxaConfigExport'
import type { FuxaViewSummary } from '../../domain/config/types'
import { generateId, type RandomValuesProvider } from '../../domain/ids'

export function findEditableTargetView(
  views: readonly FuxaViewSummary[],
  sourceViewId: string,
  models: ReadonlyMap<string, unknown>,
): FuxaViewSummary | undefined {
  return views.find((view) => {
    const id = view.id || view.key
    return id !== sourceViewId && models.has(id)
  })
}

export interface ComponentsMoveInput {
  models: ReadonlyMap<string, ExportViewModel>
  modifiedViewIds: ReadonlySet<string>
  sourceViewId: string
  componentKeys: readonly string[]
  targetViewId: string
  randomValues: RandomValuesProvider
}

export type ComponentsMovePlan =
  | {
    ok: true
    models: Map<string, ExportViewModel>
    modifiedViewIds: Set<string>
    movedCount: number
  }
  | { ok: false; error: string }

export function planComponentsMove(input: ComponentsMoveInput): ComponentsMovePlan {
  const { models, sourceViewId, componentKeys, targetViewId, randomValues } = input
  const sourceModel = models.get(sourceViewId)
  const targetModel = models.get(targetViewId)
  if (!sourceModel || !targetModel || sourceViewId === targetViewId) {
    return { ok: false, error: '來源或目標 View 不可編輯，無法移動元件。' }
  }
  const keySet = new Set(componentKeys)
  const components = sourceModel.components.filter((item) =>
    keySet.has(item.key) && item.managed !== false)
  if (components.length !== keySet.size) {
    return { ok: false, error: '部分選取項目已不存在或不是可移動的受管理元件。' }
  }

  const usedKeys = new Set(
    [...models.values()].flatMap((model) => model.components.map((item) => item.key)),
  )
  let sequence = targetModel.components.reduce((maximum, item) => {
    if (item.managed === false || !Number.isSafeInteger(item.seq)) return maximum
    return Math.max(maximum, item.seq ?? 0)
  }, 0)
  const movedComponents = components.map((component) => ({
    ...component,
    key: `moved-${generateId('component', usedKeys, randomValues)}`,
    seq: ++sequence,
  }))
  const nextModels = new Map(models)
  nextModels.set(sourceViewId, {
    ...sourceModel,
    components: sourceModel.components.filter((item) => !keySet.has(item.key)),
  })
  nextModels.set(targetViewId, {
    ...targetModel,
    components: [...targetModel.components, ...movedComponents],
  })
  const nextModifiedViewIds = new Set(input.modifiedViewIds)
  nextModifiedViewIds.add(sourceViewId)
  nextModifiedViewIds.add(targetViewId)
  return {
    ok: true,
    models: nextModels,
    modifiedViewIds: nextModifiedViewIds,
    movedCount: components.length,
  }
}
