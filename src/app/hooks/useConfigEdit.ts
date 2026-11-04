import type { ExportViewModel } from '../../domain/config/prepareFuxaConfigExport'
import type { ParsedFuxaConfig } from '../../domain/config/types'
import { parseUpdatedConfig } from '../lib/parseUpdatedConfig'
import { useEditorContext } from '../store/editorContext'

export function useConfigEdit() {
  const { editor, dispatch } = useEditorContext()

  function replaceDocument(
    document: ParsedFuxaConfig,
    nextModels: Map<string, ExportViewModel>,
    nextModifiedViewIds?: Set<string>,
  ) {
    dispatch({
      type: 'document-edit',
      document,
      models: nextModels,
      modifiedViewIds: nextModifiedViewIds,
    })
  }

  function commitDocumentEdit(
    base: ParsedFuxaConfig,
    nextRaw: ParsedFuxaConfig['rawConfig'],
    nextModels: Map<string, ExportViewModel> = editor.models,
    nextModifiedViewIds?: Set<string>,
  ) {
    replaceDocument(parseUpdatedConfig(nextRaw, base), nextModels, nextModifiedViewIds)
  }

  function editView(viewId: string, model: ExportViewModel) {
    dispatch({ type: 'edit', viewId, model })
  }

  function resetEditor(models: Map<string, ExportViewModel>, document: ParsedFuxaConfig | null) {
    dispatch({ type: 'reset', models, document })
  }

  return {
    editor,
    commitDocumentEdit,
    replaceDocument,
    editView,
    resetEditor,
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
  }
}
