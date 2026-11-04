import type { FuxaConfig } from '../../domain/config/types'
import type { ExportViewModel } from '../../domain/config/prepareFuxaConfigExport'
import type { AutoViewDevicePlan } from '../../domain/views/autoViewComponentPlans'
import { generateId } from '../../domain/ids'
import {
  collectUsedIds,
  type CreateViewComponentsRuntime,
} from './createViewComponents'

export type CreateAutoViewComponentsRuntime = CreateViewComponentsRuntime

/**
 * 依一鍵配置的元件計畫建立 managed 元件。
 * 多狀態元件會帶入每個狀態實際綁定的 Tag；其他狀態 Tag 以開關／矩形保留。
 */
export function createAutoViewComponents(
  config: FuxaConfig,
  model: ExportViewModel,
  models: ReadonlyMap<string, ExportViewModel>,
  plans: readonly AutoViewDevicePlan[],
  runtime: CreateAutoViewComponentsRuntime,
): ExportViewModel {
  const usedIds = collectUsedIds(config, models, runtime.Parser)
  let sequence = model.components.reduce(
    (maximum, component) => Math.max(maximum, Number(component.seq) || 0),
    0,
  )
  const created = plans.flatMap((plan) => plan.components).map((planned) => {
    sequence += 1
    const common = {
      key: `new-${generateId('component', usedIds, runtime.crypto)}`,
      seq: sequence,
      tagId: planned.tagIds[0] ?? '',
      label: planned.label,
      palette: 'normal' as const,
      shapeId: generateId('SHE', usedIds, runtime.crypto),
      labelId: generateId('svg', usedIds, runtime.crypto),
      managed: true as const,
    }

    if (planned.kind === 'multi') {
      return {
        ...common,
        template: 'icon-multi' as const,
        normalIconId: planned.normalIconId,
        multiIconSetId: planned.multiIconSetId,
        multiStateBindings: (planned.multiBindings ?? []).map((binding) => ({
          stateKey: binding.stateKey,
          iconId: binding.iconId,
          tagId: binding.tagId,
          shapeId: generateId('SHE', usedIds, runtime.crypto),
        })),
        shapeInnerIds: [],
      }
    }

    if (planned.kind === 'pair') {
      return {
        ...common,
        template: 'icon-pair' as const,
        normalIconId: planned.normalIconId,
        alarmIconId: planned.alarmIconId,
        alarmShapeId: generateId('SHE', usedIds, runtime.crypto),
        ...(planned.invertIconState ? { invertIconState: true } : {}),
        shapeInnerIds: [],
      }
    }

    if (planned.kind === 'icon') {
      return {
        ...common,
        template: 'icon' as const,
        iconId: planned.iconId,
        shapeInnerIds: [],
      }
    }

    return {
      ...common,
      template: planned.kind,
      shapeInnerIds: [generateId('SHE', usedIds, runtime.crypto)],
    }
  })

  return { ...model, components: [...model.components, ...created] }
}
