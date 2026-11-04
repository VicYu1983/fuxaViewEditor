import { useReducer, type ReactNode } from 'react'
import type { ExportViewModel } from '../../domain/config/prepareFuxaConfigExport'
import type { ParsedFuxaConfig } from '../../domain/config/types'
import { createEditorHistoryState, editorHistoryReducer } from './editorHistory'
import { EditorContext } from './editorContext'

export function EditorProvider({ children }: { children: ReactNode }) {
  const [editor, dispatch] = useReducer(
    editorHistoryReducer<ExportViewModel, ParsedFuxaConfig>,
    undefined,
    () => createEditorHistoryState<ExportViewModel, ParsedFuxaConfig>(),
  )
  return (
    <EditorContext.Provider value={{ editor, dispatch }}>
      {children}
    </EditorContext.Provider>
  )
}
