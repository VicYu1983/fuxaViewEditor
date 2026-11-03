import type { FuxaViewSummary, ParsedFuxaConfig } from '../config/types'
import type { ExportViewModel } from '../config/prepareFuxaConfigExport'
import { isRecord } from '../shared/isRecord'
import type { IndexedTag } from './index'

export function buildDuplicateTagGroups(tags: readonly IndexedTag[]): IndexedTag[][] {
  const names = new Map<string, IndexedTag[]>()
  for (const tag of tags) {
    const name = tag.name.trim().toLocaleLowerCase()
    if (!name) continue
    const group = names.get(name) ?? []
    group.push(tag)
    names.set(name, group)
  }
  return [...names.values()].filter((group) => group.length > 1)
}

export function buildTagViewOptions(
  config: Pick<ParsedFuxaConfig, 'rawConfig' | 'views'>,
  models: ReadonlyMap<string, ExportViewModel>,
): Map<string, FuxaViewSummary[]> {
  const optionsByTag = new Map<string, FuxaViewSummary[]>()
  const addTagView = (tagId: string, viewId: string, viewName?: string) => {
    const view = config.views.find((candidate) => candidate.id === viewId)
      ?? { id: viewId, key: viewId, name: viewName || viewId }
    const options = optionsByTag.get(tagId) ?? []
    if (!options.some((candidate) => candidate.id === viewId)) options.push(view)
    optionsByTag.set(tagId, options)
  }
  if (Array.isArray(config.rawConfig.hmi.views)) {
    for (const rawView of config.rawConfig.hmi.views) {
      if (!isRecord(rawView) || !isRecord(rawView.items)) continue
      const viewId = typeof rawView.id === 'string' ? rawView.id : ''
      if (!viewId) continue
      for (const item of Object.values(rawView.items)) {
        if (!isRecord(item) || !isRecord(item.property)) continue
        const tagId = item.property.variableId
        if (typeof tagId === 'string') {
          addTagView(tagId, viewId, String(rawView.name || viewId))
        }
      }
    }
  }
  for (const [viewId, model] of models) {
    const viewName = config.views.find((candidate) => candidate.id === viewId)?.name
    for (const component of model.components) {
      if (component.tagId) addTagView(component.tagId, viewId, viewName)
      for (const binding of component.multiStateBindings ?? []) {
        if (binding.tagId) addTagView(binding.tagId, viewId, viewName)
      }
    }
  }
  return optionsByTag
}
