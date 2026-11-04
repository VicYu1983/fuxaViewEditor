import { describe, expect, it } from 'vitest'
import { buildViewTargetOptions } from '../../../src/domain/views/viewTargetOptions'

describe('buildViewTargetOptions', () => {
  const models = new Map<string, unknown>([
    ['v1', {}],
    ['v2', {}],
    ['v3', {}],
  ])

  it('uses id, falling back to key, and name, falling back to id', () => {
    const options = buildViewTargetOptions(
      [
        { id: 'v1', name: 'Plant A' },
        { key: 'v2', name: '' },
      ],
      models,
      undefined,
    )

    expect(options).toEqual([
      { value: 'v1', label: 'Plant A' },
      { value: 'v2', label: 'v2' },
    ])
  })

  it('excludes the current view', () => {
    const options = buildViewTargetOptions(
      [
        { id: 'v1', name: 'A' },
        { id: 'v2', name: 'B' },
      ],
      models,
      'v1',
    )

    expect(options).toEqual([{ value: 'v2', label: 'B' }])
  })

  it('skips views that have no loaded model', () => {
    const options = buildViewTargetOptions(
      [
        { id: 'v1', name: 'A' },
        { id: 'missing', name: 'Missing' },
      ],
      models,
      undefined,
    )

    expect(options).toEqual([{ value: 'v1', label: 'A' }])
  })
})
