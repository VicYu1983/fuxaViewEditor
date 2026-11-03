// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IconLibraryDialog, type IconAddDraft } from '../../../src/ui/icons/IconLibraryDialog'

// antd Modal and Sider observe size; jsdom does not implement ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

function renderDialog(onAddIcon: (draft: IconAddDraft) => Promise<boolean>) {
  render(
    <IconLibraryDialog
      open
      onClose={vi.fn()}
      canEdit
      iconLibrary={[]}
      onExport={vi.fn()}
      onImport={vi.fn()}
      onAddIcon={onAddIcon}
      onRemoveIcon={vi.fn()}
      onEditMultiStateIcon={vi.fn()}
    />,
  )
}

describe('IconLibraryDialog add form', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps the draft when adding fails and clears it when adding succeeds', async () => {
    const onAddIcon = vi.fn<(draft: IconAddDraft) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    renderDialog(onAddIcon)

    const nameInput = screen.getByLabelText('圖示名稱（必填）') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'pump' } })
    const fileInput = document.querySelector('input[accept="image/png,image/jpeg,image/gif"]') as HTMLInputElement
    const file = new File(['x'], 'pump.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    const addButton = screen.getByRole('button', { name: /新增至圖示庫/ })
    fireEvent.click(addButton)
    await waitFor(() => expect(onAddIcon).toHaveBeenCalledTimes(1))
    expect(onAddIcon.mock.calls[0]?.[0]).toMatchObject({
      name: 'pump',
      type: 'single',
      singleFile: file,
    })
    expect(nameInput.value).toBe('pump')

    fireEvent.click(addButton)
    await waitFor(() => expect(onAddIcon).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(nameInput.value).toBe(''))
  })
})
