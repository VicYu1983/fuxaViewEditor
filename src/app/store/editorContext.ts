import { createContext, useContext, type Dispatch } from 'react'
import type { ExportViewModel } from '../../domain/config/prepareFuxaConfigExport'
import type { ParsedFuxaConfig } from '../../domain/config/types'
import type { EditorHistoryAction, EditorHistoryState } from './editorHistory'

export type EditorState = EditorHistoryState<ExportViewModel, ParsedFuxaConfig>
export type EditorAction = EditorHistoryAction<ExportViewModel, ParsedFuxaConfig>

export interface EditorContextValue {
  editor: EditorState
  dispatch: Dispatch<EditorAction>
}

export const EditorContext = createContext<EditorContextValue | null>(null)

export function useEditorContext(): EditorContextValue {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error('useEditorContext must be used inside EditorProvider')
  }
  return context
}
