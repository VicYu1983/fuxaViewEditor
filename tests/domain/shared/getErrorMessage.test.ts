import { describe, expect, it } from 'vitest'
import { getErrorMessage } from '../../../src/domain/shared/getErrorMessage'

describe('getErrorMessage', () => {
  it('returns the message of an Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('stringifies non-Error values', () => {
    expect(getErrorMessage('plain')).toBe('plain')
    expect(getErrorMessage(42)).toBe('42')
    expect(getErrorMessage(undefined)).toBe('undefined')
  })
})
