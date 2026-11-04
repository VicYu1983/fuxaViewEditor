import type { ExportViewModel } from '../../domain/config/prepareFuxaConfigExport'
import type { FuxaConfig } from '../../domain/config/types'
import { isRecord } from '../../domain/config/validateFuxaConfig'
import { isCoilTag, type IndexedTag } from '../../domain/tags/index'
import {
  AUTO_VIEW_EMPTY_VIEW_NAME,
  classifyTagsForViews,
  filterAutoViewTags,
  saveAutoViewMapping,
  UNCLASSIFIED_VIEW_NAME,
  validateAutoViewMapping,
  type AutoViewGroup,
} from '../../domain/views/autoViewMapping'
import { createViewComponents } from '../tags/createViewComponents'
import { createBlankView, type CreateBlankViewRuntime } from './createBlankView'
import { createEmptyViewModel } from './createViewModel'

export interface CreateAutoViewsOptions {
  groups: readonly AutoViewGroup[]
  tags: readonly IndexedTag[]
  includeAutoFilled?: boolean
  /** Boolean Coil 是否建立為 Switch，預設 true。 */
  coilSwitchEnabled?: boolean
}

export interface CreateAutoViewsResult {
  config: FuxaConfig
  models: Map<string, ExportViewModel>
  viewIds: string[]
  addedTagCount: number
  unclassifiedTagCount: number
  /** 因「排除自動補位 Tag」而未加入的數量。 */
  skippedTagCount: number
}

function isBooleanTag(tag: IndexedTag): boolean {
  return ['bool', 'boolean'].includes(tag.type.toLocaleLowerCase())
}

/**
 * 清除所有 View，依分類表建立 View 並加入 Tag 元件。
 * 不修改輸入的 config；呼叫端需把回傳的 config／models 寫回編輯器。
 */
export function createAutoViews(
  config: FuxaConfig,
  options: CreateAutoViewsOptions,
  runtime: CreateBlankViewRuntime,
): CreateAutoViewsResult {
  const errors = validateAutoViewMapping(options.groups)
  if (errors.length) throw new Error(errors[0])

  const tags = filterAutoViewTags(options.tags, options.includeAutoFilled === true)
  const classification = classifyTagsForViews(tags, options.groups)
  const next = structuredClone(config)

  // 以舊專案第一個 View 的畫布設定作為新 View 的範本，避免一鍵配置後尺寸改變。
  const templateProfile = config.hmi.views
    .flatMap((view) => (isRecord(view) && isRecord(view.profile) ? [view.profile] : []))[0]
  const referenceView = templateProfile
    ? {
      id: '__auto_view_reference__',
      name: '',
      profile: structuredClone(templateProfile),
      items: {},
      svgcontent: '',
    }
    : undefined

  next.hmi.views = referenceView ? [referenceView] : []
  const layout = isRecord(next.hmi.layout) ? next.hmi.layout : undefined
  if (layout) {
    layout.start = ''
    const navigation = isRecord(layout.navigation) ? layout.navigation : undefined
    // 舊導覽項目可能指向已刪除的 View；清空後由匯出流程依新 View 重建。
    if (navigation) navigation.items = []
  }
  saveAutoViewMapping(next, options.groups)

  const groupsToCreate: Array<{ name: string; tags: IndexedTag[] }> = classification.groups
    .filter((group) => group.tags.length > 0)
    .map((group) => ({ name: group.name, tags: group.tags }))
  if (classification.unclassified.length > 0) {
    groupsToCreate.push({
      name: UNCLASSIFIED_VIEW_NAME,
      tags: classification.unclassified,
    })
  }
  if (groupsToCreate.length === 0) {
    groupsToCreate.push({ name: AUTO_VIEW_EMPTY_VIEW_NAME, tags: [] })
  }

  const models = new Map<string, ExportViewModel>()
  const viewIds: string[] = []
  let addedTagCount = 0

  for (const group of groupsToCreate) {
    const { view } = createBlankView(
      next,
      group.name,
      viewIds[0] ?? referenceView?.id ?? '',
      runtime,
    )
    if (typeof view.id !== 'string' || !view.id) {
      throw new Error(`建立 View「${group.name}」時缺少有效 ID。`)
    }
    const viewId = view.id
    next.hmi.views.push(view)
    if (referenceView) {
      next.hmi.views = next.hmi.views.filter((candidate) => candidate !== referenceView)
    }

    let model = createEmptyViewModel(next, viewId)
    if (group.tags.length > 0) {
      const switchTagIds = options.coilSwitchEnabled === false
        ? new Set<string>()
        : new Set(group.tags
          .filter((tag) => isCoilTag(tag) && isBooleanTag(tag))
          .map((tag) => tag.id))
      model = createViewComponents(
        next,
        model,
        models,
        group.tags,
        runtime,
        'rect',
        [],
        switchTagIds,
      )
      addedTagCount += group.tags.length
    }

    models.set(viewId, model)
    viewIds.push(viewId)
  }

  if (layout) layout.start = viewIds[0] ?? ''

  return {
    config: next,
    models,
    viewIds,
    addedTagCount,
    unclassifiedTagCount: classification.unclassified.length,
    skippedTagCount: options.tags.length - tags.length,
  }
}
