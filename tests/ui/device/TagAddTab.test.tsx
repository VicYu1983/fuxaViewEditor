// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IndexedTag } from '../../../src/domain/tags/index'
import {
  TagAddTab,
  type TagAddTabHandle,
} from '../../../src/ui/device/TagAddTab'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

function makeTag(id: string, name: string, memaddress = '100'): IndexedTag {
  return {
    id,
    name,
    type: 'Bool',
    memaddress,
    deviceId: 'dev-1',
    deviceName: 'DevA',
    floor: '1F',
    record: {},
  } as unknown as IndexedTag
}

function renderTab(tags: IndexedTag[]) {
  const ref = createRef<TagAddTabHandle>()
  const onSubmit = vi.fn()
  const onStatusChange = vi.fn()
  render(
    <TagAddTab
      ref={ref}
      tags={tags}
      models={new Map()}
      currentViewTagIds={new Set()}
      iconLibrary={[]}
      onSubmit={onSubmit}
      onStatusChange={onStatusChange}
    />,
  )
  return { ref, onSubmit, onStatusChange }
}

describe('TagAddTab', () => {
  afterEach(() => {
    cleanup()
  })

  it('reports an empty selection initially', () => {
    const { onStatusChange } = renderTab([makeTag('t1', 'Pump')])
    expect(onStatusChange).toHaveBeenLastCalledWith({ selectedCount: 0 })
  })

  it('submits the selected tag ids with default graphic and coil switch option', () => {
    const { ref, onSubmit, onStatusChange } = renderTab([
      makeTag('t1', 'Pump'),
      makeTag('t2', 'Fan'),
    ])
    fireEvent.click(screen.getByRole('checkbox', { name: /Pump/ }))
    expect(onStatusChange).toHaveBeenLastCalledWith({ selectedCount: 1 })

    act(() => {
      ref.current?.submit()
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const request = onSubmit.mock.calls[0]?.[0]
    expect(request.tagIds).toEqual(new Set(['t1']))
    expect(request.graphic).toBe('rect')
    expect(request.coilSwitchEnabled).toBe(true)
  })

  it('filters tags by the search text', () => {
    renderTab([makeTag('t1', 'Pump'), makeTag('t2', 'Fan')])
    fireEvent.change(screen.getByLabelText('搜尋 Tag'), { target: { value: 'fan' } })
    expect(screen.queryByRole('checkbox', { name: /Pump/ })).toBeNull()
    expect(screen.getByRole('checkbox', { name: /Fan/ })).toBeTruthy()
  })

  it('shows an empty message when nothing matches the search', () => {
    renderTab([makeTag('t1', 'Pump')])
    fireEvent.change(screen.getByLabelText('搜尋 Tag'), { target: { value: 'zzz' } })
    expect(screen.getByText('沒有符合的 Tag。')).toBeTruthy()
  })
})
