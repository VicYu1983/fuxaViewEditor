import type { ExportViewModel } from '../../domain/config/prepareFuxaConfigExport'

export type TagReferenceComponent = ExportViewModel['components'][number]

export interface TagReferenceGroup {
  viewId: string
  model: ExportViewModel
  components: TagReferenceComponent[]
}

export function findTagReferences(
  models: ReadonlyMap<string, ExportViewModel>,
  tagIds: ReadonlySet<string>,
): TagReferenceGroup[] {
  return [...models.entries()].flatMap(([viewId, model]) => {
    const components = model.components.filter((component) => (
      tagIds.has(component.tagId)
      || component.multiStateBindings?.some((binding) => tagIds.has(binding.tagId))
    ))
    return components.length ? [{ viewId, model, components }] : []
  })
}
