// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ParsedFuxaConfig } from '../../../src/domain/config/types'
import {
  TagAlarmsTab,
  type TagAlarmsTabHandle,
} from '../../../src/ui/device/TagAlarmsTab'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

function makeConfig(): ParsedFuxaConfig {
  return {
    rawConfig: { devices: {}, hmi: { views: [] }, alarms: {} },
  } as unknown as ParsedFuxaConfig
}

function renderTab() {
  const ref = createRef<TagAlarmsTabHandle>()
  const onDocumentEdit = vi.fn()
  const onNotify = vi.fn()
  const onStatusChange = vi.fn()
  render(
    <TagAlarmsTab
      ref={ref}
      config={makeConfig()}
      tags={[]}
      models={new Map()}
      onDocumentEdit={onDocumentEdit}
      onNotify={onNotify}
      onStatusChange={onStatusChange}
    />,
  )
  return { ref, onDocumentEdit, onNotify, onStatusChange }
}

describe('TagAlarmsTab', () => {
  afterEach(() => {
    cleanup()
  })

  it('reports an empty selection that cannot be submitted', () => {
    const { onStatusChange } = renderTab()
    expect(onStatusChange).toHaveBeenLastCalledWith({ selectedCount: 0, canSubmit: false })
  })

  it('warns and does not edit the document when submitting without a selection', () => {
    const { ref, onDocumentEdit, onNotify } = renderTab()
    act(() => {
      ref.current?.submit()
    })
    expect(onNotify).toHaveBeenCalledWith('warning', '請至少選擇一個 Tag。')
    expect(onDocumentEdit).not.toHaveBeenCalled()
  })
})
