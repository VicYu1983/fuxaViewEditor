// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { MessageInstance } from 'antd/es/message/interface'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFuxaHost } from '../../../src/app/hooks/useFuxaHost'

describe('useFuxaHost', () => {
  const originalOpener = window.opener

  afterEach(() => {
    cleanup()
    Object.defineProperty(window, 'opener', { value: originalOpener, configurable: true })
  })

  function mockHostWindow() {
    const host = { postMessage: vi.fn() }
    Object.defineProperty(window, 'opener', { value: host, configurable: true })
    return host
  }

  const messageApi = {
    error: vi.fn(),
    success: vi.fn(),
  } as unknown as MessageInstance

  it('announces readiness to the host window on mount', () => {
    const host = mockHostWindow()

    renderHook(() => useFuxaHost({
      messageApi,
      loadProject: vi.fn(),
      buildSyncProject: () => ({}),
    }))

    expect(host.postMessage).toHaveBeenCalledWith({
      source: 'fuxa-view-editor',
      protocol: 1,
      type: 'ready',
    }, window.location.origin)
  })

  it('does not send a sync request before the host has provided a project', () => {
    const host = mockHostWindow()
    const buildSyncProject = vi.fn(() => ({}))

    const { result } = renderHook(() => useFuxaHost({
      messageApi,
      loadProject: vi.fn(),
      buildSyncProject,
    }))

    expect(result.current.status).toBe('disconnected')
    act(() => result.current.sync())
    expect(buildSyncProject).not.toHaveBeenCalled()
    expect(host.postMessage).toHaveBeenCalledTimes(1)
  })
})
