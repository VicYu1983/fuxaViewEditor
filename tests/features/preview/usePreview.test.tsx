// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { usePreview } from '../../../src/features/preview/usePreview'

describe('usePreview', () => {
  afterEach(() => {
    cleanup()
  })

  it('has no preview and is not stale without a config or selected view', () => {
    const { result } = renderHook(() =>
      usePreview({ config: null, models: new Map(), selectedView: undefined }))

    expect(result.current.preview).toBeNull()
    expect(result.current.stale).toBe(false)
    expect(result.current.realtime).toBe(true)
  })

  it('toggles realtime mode', () => {
    const { result } = renderHook(() =>
      usePreview({ config: null, models: new Map(), selectedView: undefined }))

    act(() => result.current.setRealtime(false))
    expect(result.current.realtime).toBe(false)
  })

  it('refresh is a no-op without a config or selected view', () => {
    const { result } = renderHook(() =>
      usePreview({ config: null, models: new Map(), selectedView: undefined }))

    act(() => result.current.refresh())
    expect(result.current.preview).toBeNull()
  })
})
