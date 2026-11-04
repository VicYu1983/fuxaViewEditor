// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IndexedTag } from '../../../src/domain/tags/index'
import { AutoViewDialog } from '../../../src/ui/view/AutoViewDialog'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

function makeTag(id: string, name: string): IndexedTag {
  return {
    id,
    name,
    type: 'Bool',
    memaddress: '100',
    deviceId: 'dev-1',
    deviceName: 'DevA',
    floor: '',
    record: {},
  } as unknown as IndexedTag
}

const mapping = [
  { name: '消防系統', keywords: ['消防', 'co2'] },
  { name: '泵浦系統', keywords: ['泵'] },
]

const tags = [
  makeTag('t1', 'B1F消防泵運轉'),
  makeTag('t2', 'B1F泵浦運轉'),
  makeTag('t3', '一般點位'),
]

function renderDialog(overrides: Partial<Parameters<typeof AutoViewDialog>[0]> = {}) {
  const onApply = vi.fn()
  const onCancel = vi.fn()
  render(
    <AutoViewDialog
      open
      mapping={mapping}
      tags={tags}
      onApply={onApply}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onApply, onCancel }
}

describe('AutoViewDialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows the mapping and a live preview of groups and unclassified tags', () => {
    renderDialog()

    expect(screen.getByDisplayValue('消防系統')).toBeTruthy()
    expect(screen.getByDisplayValue('消防, co2')).toBeTruthy()
    expect(screen.getAllByText('消防系統').length).toBeGreaterThan(0)
    expect(screen.getAllByText('未分類').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '清除並建立 3 個 View' })).toBeTruthy()
  })

  it('applies the mapping and options', () => {
    const { onApply } = renderDialog()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Boolean Coil 建立 Switch' }))
    fireEvent.click(screen.getByRole('button', { name: '清除並建立 3 個 View' }))

    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply.mock.calls[0]?.[0]).toEqual([
      { name: '消防系統', keywords: ['消防', 'co2'] },
      { name: '泵浦系統', keywords: ['泵'] },
    ])
    expect(onApply.mock.calls[0]?.[1]).toEqual({
      includeAutoFilled: false,
      coilSwitchEnabled: false,
    })
  })

  it('updates the preview when keywords are edited', () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText('第 1 列關鍵字'), {
      target: { value: '不存在' },
    })

    expect(screen.getByRole('button', { name: '清除並建立 2 個 View' })).toBeTruthy()
    expect(screen.getByText(/B1F消防泵運轉/)).toBeTruthy()
  })

  it('disables apply when the mapping is invalid', () => {
    renderDialog({
      mapping: [{ name: '未分類', keywords: ['消防'] }],
    })

    expect(screen.getByText('分類表需要修正')).toBeTruthy()
    expect((screen.getByRole('button', { name: /清除並建立/ }) as HTMLButtonElement).disabled)
      .toBe(true)
  })
})
