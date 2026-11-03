// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FuxaViewSummary } from '../../../src/domain/config/types'
import { ViewSidebar } from '../../../src/ui/view/ViewSidebar'

// antd Sider observes its size; jsdom does not implement ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

function makeView(id: string, name: string): FuxaViewSummary {
  return { id, key: id, name } as FuxaViewSummary
}

function renderSidebar(overrides: Partial<Parameters<typeof ViewSidebar>[0]> = {}) {
  const views = [makeView('v1', 'Floor 1'), makeView('v2', 'Floor 2')]
  const props = {
    views,
    selectedView: views[0],
    onSelectView: vi.fn(),
    onCreateView: vi.fn(),
    onRenameView: vi.fn(),
    onDeleteView: vi.fn(),
    ...overrides,
  }
  render(<ViewSidebar {...props} />)
  return props
}

describe('ViewSidebar', () => {
  afterEach(() => {
    cleanup()
  })

  it('lists views and reports the clicked view id', () => {
    const props = renderSidebar()

    const nav = screen.getByRole('navigation', { name: 'View 清單' })
    expect(nav.querySelectorAll('.view-item')).toHaveLength(2)

    fireEvent.click(screen.getByText('Floor 2'))
    expect(props.onSelectView).toHaveBeenCalledWith('v2')
  })

  it('wires toolbar buttons to their callbacks', () => {
    const props = renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: '新增 View' }))
    fireEvent.click(screen.getByRole('button', { name: '修改 View 名稱' }))
    expect(props.onCreateView).toHaveBeenCalledTimes(1)
    expect(props.onRenameView).toHaveBeenCalledTimes(1)
  })

  it('disables delete when only one view remains', () => {
    renderSidebar({ views: [makeView('v1', 'Only')], selectedView: makeView('v1', 'Only') })

    const deleteButton = screen.getByRole('button', { name: '刪除 View' }) as HTMLButtonElement
    expect(deleteButton.disabled).toBe(true)
  })

  it('shows the waiting message when no project is loaded', () => {
    renderSidebar({ views: null, selectedView: undefined })

    expect(screen.getByText('等待 FUXA 傳送專案資料後，View 清單會顯示於此。')).toBeTruthy()
    const createButton = screen.getByRole('button', { name: '新增 View' }) as HTMLButtonElement
    expect(createButton.disabled).toBe(true)
  })
})
