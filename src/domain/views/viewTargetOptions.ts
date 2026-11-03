export interface ViewTargetOption {
  value: string
  label: string
}

interface ViewOptionSource {
  id?: string
  key?: string
  name?: string
}

export function buildViewTargetOptions(
  views: readonly ViewOptionSource[],
  models: ReadonlyMap<string, unknown>,
  excludeViewId: string | undefined,
): ViewTargetOption[] {
  return views
    .map((view) => ({ id: view.id || view.key || '', name: view.name }))
    .filter(({ id }) => id !== excludeViewId && models.has(id))
    .map(({ id, name }) => ({ value: id, label: name || id }))
}
