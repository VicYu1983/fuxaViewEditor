// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ExportViewModel } from '../../src/domain/config/prepareFuxaConfigExport'
import { createEmptyFuxaConfig } from '../../src/domain/config/createEmptyFuxaConfig'
import { parseFuxaConfig } from '../../src/domain/config/parseFuxaConfig'
import type { ParsedFuxaConfig } from '../../src/domain/config/types'
import { useConfigEdit } from '../../src/app/hooks/useConfigEdit'
import { EditorProvider } from '../../src/app/store/EditorProvider'

function wrapper({ children }: { children: ReactNode }) {
  return <EditorProvider>{children}</EditorProvider>
}

function createModel(id: string): ExportViewModel {
  return { id, components: [], grid: {} } as unknown as ExportViewModel
}

function createParsedConfig(): ParsedFuxaConfig {
  return parseFuxaConfig(JSON.stringify(createEmptyFuxaConfig()))
}

describe('useConfigEdit', () => {
  afterEach(() => {
    cleanup()
  })

  it('edits a view model and supports undo and redo', () => {
    const { result } = renderHook(() => useConfigEdit(), { wrapper })
    const model = createModel('view-1')

    act(() => result.current.editView('view-1', model))
    expect(result.current.editor.models.get('view-1')).toBe(model)
    expect(result.current.editor.modifiedViewIds.has('view-1')).toBe(true)

    act(() => result.current.undo())
    expect(result.current.editor.models.has('view-1')).toBe(false)

    act(() => result.current.redo())
    expect(result.current.editor.models.get('view-1')).toBe(model)
  })

  it('ignores editing a view with the identical model object', () => {
    const { result } = renderHook(() => useConfigEdit(), { wrapper })
    const model = createModel('view-1')

    act(() => result.current.editView('view-1', model))
    const before = result.current.editor
    act(() => result.current.editView('view-1', model))

    expect(result.current.editor).toBe(before)
  })

  it('resets the editor with the given models and document', () => {
    const { result } = renderHook(() => useConfigEdit(), { wrapper })
    const parsed = createParsedConfig()
    const models = new Map([['view-1', createModel('view-1')]])

    act(() => result.current.resetEditor(models, parsed))

    expect(result.current.editor.document).toBe(parsed)
    expect(result.current.editor.models).toBe(models)
    expect(result.current.editor.configurationDirty).toBe(false)
    expect(result.current.editor.past).toHaveLength(0)
  })

  it('commits a document edit and marks configuration dirty', () => {
    const { result } = renderHook(() => useConfigEdit(), { wrapper })
    const base = createParsedConfig()
    act(() => result.current.resetEditor(new Map(), base))

    const nextRaw = structuredClone(base.rawConfig)
    nextRaw.name = 'Renamed Project'
    act(() => result.current.commitDocumentEdit(base, nextRaw))

    expect(result.current.editor.document?.rawConfig.name).toBe('Renamed Project')
    expect(result.current.editor.configurationDirty).toBe(true)

    act(() => result.current.undo())
    expect(result.current.editor.document).toBe(base)
  })
})
