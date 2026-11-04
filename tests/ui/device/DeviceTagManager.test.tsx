// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Form } from 'antd'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ManagedDeviceTag } from '../../../src/domain/devices/readModbusDevices'
import type { DeviceTagUpdate } from '../../../src/features/devices/manageDeviceTags'
import {
  DeviceTagManager,
  type DeviceTagManagerProps,
} from '../../../src/ui/device/DeviceTagManager'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

function makeTag(overrides: Partial<ManagedDeviceTag> & { id: string; name: string }): ManagedDeviceTag {
  return {
    type: 'Coil',
    memaddress: '000000',
    address: '1',
    description: '',
    floor: '',
    ...overrides,
  } as unknown as ManagedDeviceTag
}

const tags: ManagedDeviceTag[] = [
  makeTag({ id: 't1', name: 'Pump1', floor: '1F', address: '10' }),
  makeTag({ id: 't2', name: 'Valve2', floor: '2F' }),
  makeTag({ id: 't3', name: 'Fan3', floor: '' }),
]

function Harness(props: Omit<DeviceTagManagerProps, 'editForm'>) {
  const [form] = Form.useForm<DeviceTagUpdate>()
  return <DeviceTagManager {...props} editForm={form} />
}

function renderManager(overrides: Partial<Omit<DeviceTagManagerProps, 'editForm'>> = {}) {
  const props = {
    sourceName: 'PLC-A',
    tags,
    duplicateTagIds: new Set<string>(),
    moveTargets: [{ id: 'dev-2', name: 'PLC-B' }],
    existingTags: tags.map((tag) => ({ id: tag.id, name: tag.name })),
    onPrepareEdit: vi.fn(() => true),
    onUpdateTag: vi.fn(() => true),
    onMoveTags: vi.fn(() => true),
    onDeleteTag: vi.fn(),
    ...overrides,
  }
  render(<Harness {...props} />)
  return props
}

describe('DeviceTagManager', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows the tag count and every row', () => {
    renderManager()
    expect(screen.getByText('3 / 3 個')).toBeTruthy()
    expect(screen.getByLabelText('選取 Tag Pump1')).toBeTruthy()
    expect(screen.getByLabelText('選取 Tag Valve2')).toBeTruthy()
    expect(screen.getByLabelText('選取 Tag Fan3')).toBeTruthy()
  })

  it('filters rows by the search text', () => {
    renderManager()
    fireEvent.change(screen.getByLabelText('搜尋設備 Tag'), { target: { value: 'valve' } })
    expect(screen.getByText('1 / 3 個')).toBeTruthy()
    expect(screen.queryByLabelText('選取 Tag Pump1')).toBeNull()
    expect(screen.getByLabelText('選取 Tag Valve2')).toBeTruthy()
  })

  it('shows a duplicate-name warning for flagged tags', () => {
    renderManager({ duplicateTagIds: new Set(['t2']) })
    expect(screen.getByText('名稱重複，請修改 Tag 名稱')).toBeTruthy()
  })

  it('selects a tag and enables the bulk move button with the count', () => {
    renderManager()
    fireEvent.click(screen.getByLabelText('選取 Tag Pump1'))
    expect(screen.getByText(/批次移動 Tag（1）/)).toBeTruthy()
  })

  it('select-all toggles every visible tag', () => {
    renderManager()
    fireEvent.click(screen.getByText('全選可見 Tag'))
    expect(screen.getByText(/批次移動 Tag（3）/)).toBeTruthy()
    fireEvent.click(screen.getByText('全選可見 Tag'))
    expect(screen.getByText(/批次移動 Tag（0）/)).toBeTruthy()
  })

  it('moves the selected tags to the chosen target when the move succeeds', async () => {
    const props = renderManager()
    fireEvent.click(screen.getByLabelText('選取 Tag Pump1'))
    fireEvent.click(screen.getByText(/批次移動/))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('PLC-B')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: /移\s*動/ }))
    await waitFor(() => {
      expect(props.onMoveTags).toHaveBeenCalledWith('dev-2', ['t1'])
    })
    await waitFor(() => {
      expect(screen.getByText(/批次移動 Tag（0）/)).toBeTruthy()
    })
  })

  it('keeps the move dialog open when the move fails', async () => {
    const props = renderManager({ onMoveTags: vi.fn(() => false) })
    fireEvent.click(screen.getByLabelText('選取 Tag Pump1'))
    fireEvent.click(screen.getByText(/批次移動/))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /移\s*動/ }))
    await waitFor(() => {
      expect(props.onMoveTags).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/批次移動 Tag（1）/)).toBeTruthy()
  })

  it('does not open the edit dialog when the tag cannot be prepared', () => {
    const props = renderManager({ onPrepareEdit: vi.fn(() => false) })
    fireEvent.click(screen.getAllByRole('button', { name: /修\s*改/ })[0]!)
    expect(props.onPrepareEdit).toHaveBeenCalledWith('t1')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the edit dialog when the tag is prepared', async () => {
    const props = renderManager()
    fireEvent.click(screen.getAllByRole('button', { name: /修\s*改/ })[0]!)
    expect(props.onPrepareEdit).toHaveBeenCalledWith('t1')
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  it('reports deletion of the clicked tag', () => {
    const props = renderManager()
    fireEvent.click(screen.getAllByRole('button', { name: /刪\s*除/ })[1]!)
    expect(props.onDeleteTag).toHaveBeenCalledWith('t2')
  })

  it('shows the empty state when the device has no tags', () => {
    renderManager({ tags: [] })
    expect(screen.getByText('此設備尚無 Tag。')).toBeTruthy()
  })
})
