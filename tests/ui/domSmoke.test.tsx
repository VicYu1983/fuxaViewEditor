// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { Button } from 'antd'
import { describe, expect, it } from 'vitest'

describe('DOM test environment', () => {
  it('renders an antd component with Testing Library', () => {
    render(<Button>Save</Button>)

    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })
})
