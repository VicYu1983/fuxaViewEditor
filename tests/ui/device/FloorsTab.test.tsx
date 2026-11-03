// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IndexedTag } from '../../../src/domain/tags/index'
import { FloorsTab } from '../../../src/ui/device/FloorsTab'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

function makeTag(overrides: Partial<IndexedTag> & { id: string; name: string }): IndexedTag {
  return {
    type: 'Coil',
    memaddress: '000000',
    deviceId: 'dev-1',
    deviceName: 'PLC-A',
    floor: '',
    record: { address: '1' },
    ...overrides,
  } as IndexedTag
}

const tags: IndexedTag[] = [
  makeTag({ id: 't1', name: 'Pump1', floor: '1F', record: { address: '10' } }),
  makeTag({ id: 't2', name: 'Valve2', floor: '2F', deviceName: 'PLC-B' }),
  makeTag({ id: 't3', name: 'Fan3', floor: '' }),
]

function renderTab(list: IndexedTag[] = tags) {
  const onApplyFloor = vi.fn()
  const onNotify = vi.fn()
  render(
    <FloorsTab tags={list} onApplyFloor={onApplyFloor} onNotify={onNotify} />,
  )
  return { onApplyFloor, onNotify }
}

describe('FloorsTab', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows the tag count and every tag row', () => {
    renderTab()
    expect(screen.getByText('3 個 Tag · 已選 0 個')).toBeTruthy()
    expect(screen.getByLabelText('選取 PLC-A／Pump1')).toBeTruthy()
    expect(screen.getByLabelText('選取 PLC-B／Valve2')).toBeTruthy()
    expect(screen.getByLabelText('選取 PLC-A／Fan3')).toBeTruthy()
  })

  it('filters rows by the search text', () => {
    renderTab()
    fireEvent.change(screen.getByLabelText('搜尋樓層 Tag'), { target: { value: 'valve' } })
    expect(screen.queryByLabelText('選取 PLC-A／Pump1')).toBeNull()
    expect(screen.getByLabelText('選取 PLC-B／Valve2')).toBeTruthy()
  })

  it('disables bulk apply until a tag is selected', () => {
    renderTab()
    const apply = screen.getByRole('button', { name: /套用/ }) as HTMLButtonElement
    expect(apply.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('選取 PLC-A／Pump1'))
    expect(apply.disabled).toBe(false)
    expect(screen.getByText('3 個 Tag · 已選 1 個')).toBeTruthy()
  })

  it('applies the bulk floor to every selected tag and clears the input', () => {
    const { onApplyFloor } = renderTab()
    fireEvent.click(screen.getByLabelText('選取 PLC-A／Pump1'))
    fireEvent.click(screen.getByLabelText('選取 PLC-A／Fan3'))
    const input = screen.getByLabelText('批次設定樓層') as HTMLInputElement
    fireEvent.change(input, { target: { value: '3F' } })
    fireEvent.click(screen.getByRole('button', { name: /套用/ }))
    expect(onApplyFloor).toHaveBeenCalledWith(['t1', 't3'], '3F')
    expect(input.value).toBe('')
  })

  it('selects all visible tags with the select-all checkbox', () => {
    renderTab()
    fireEvent.click(screen.getByLabelText('全選可見 Tag'))
    expect(screen.getByText('3 個 Tag · 已選 3 個')).toBeTruthy()
  })

  it('applies a per-tag floor on blur only when it changed', () => {
    const { onApplyFloor } = renderTab()
    const input = screen.getByLabelText('Fan3 的樓層') as HTMLInputElement
    fireEvent.change(input, { target: { value: '4F' } })
    fireEvent.blur(input)
    expect(onApplyFloor).toHaveBeenCalledWith(['t3'], '4F')

    onApplyFloor.mockClear()
    const unchanged = screen.getByLabelText('Pump1 的樓層') as HTMLInputElement
    fireEvent.blur(unchanged)
    expect(onApplyFloor).not.toHaveBeenCalled()
  })

  it('shows an empty state when no tag matches', () => {
    renderTab()
    fireEvent.change(screen.getByLabelText('搜尋樓層 Tag'), { target: { value: 'no-such-tag' } })
    expect(screen.getByText('沒有符合條件的 Tag。')).toBeTruthy()
  })
})
