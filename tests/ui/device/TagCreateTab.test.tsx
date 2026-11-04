// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ParsedFuxaConfig } from '../../../src/domain/config/types'
import {
  TagCreateTab,
  type TagCreateRequest,
  type TagCreateTabHandle,
} from '../../../src/ui/device/TagCreateTab'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

function makeConfig(): ParsedFuxaConfig {
  return {
    rawConfig: { devices: { '1': { name: 'D1', tags: {} } } },
  } as unknown as ParsedFuxaConfig
}

function renderTab(returnValue: number | null = null) {
  const ref = createRef<TagCreateTabHandle>()
  const onCreate = vi.fn<(request: TagCreateRequest) => number | null>(() => returnValue)
  const onStatusChange = vi.fn()
  const onWarning = vi.fn()
  render(
    <TagCreateTab
      ref={ref}
      config={makeConfig()}
      initialDeviceId="1"
      canAddToView
      onCreate={onCreate}
      onWarning={onWarning}
      onStatusChange={onStatusChange}
    />,
  )
  return { ref, onCreate, onStatusChange, onWarning }
}

describe('TagCreateTab', () => {
  afterEach(() => {
    cleanup()
  })

  it('reports the parsed spec count and enables creation', () => {
    const { onStatusChange } = renderTab()
    fireEvent.change(screen.getByLabelText('批次 Tag 資料'), {
      target: { value: '泵浦\n風機' },
    })
    expect(onStatusChange).toHaveBeenLastCalledWith({ specCount: 2, canCreate: true })
  })

  it('submits the request built from the form state', () => {
    const { ref, onCreate } = renderTab()
    fireEvent.change(screen.getByLabelText('批次 Tag 資料'), {
      target: { value: '泵浦\n風機' },
    })
    act(() => ref.current?.submit())
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: '1',
      memaddress: '000000',
      alsoAddView: true,
      specs: expect.arrayContaining([expect.objectContaining({ name: '泵浦' })]),
    }))
  })

  it('clears the input after a successful create', () => {
    const { ref, onCreate } = renderTab(5)
    const textarea = screen.getByLabelText('批次 Tag 資料') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '泵浦' } })
    act(() => ref.current?.submit())
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(textarea.value).toBe('')
  })

  it('warns and does not create when the names are empty', () => {
    const { ref, onCreate, onWarning } = renderTab()
    act(() => ref.current?.submit())
    expect(onCreate).not.toHaveBeenCalled()
    expect(onWarning).toHaveBeenCalled()
  })
})
