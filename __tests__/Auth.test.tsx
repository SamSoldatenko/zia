import { expect, test, describe, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import Auth from '../app/ui/Auth'
import { ZiaProvider } from '@/app/ui/context/ZiaProvider'

describe('Auth component', () => {
  afterEach(() => {
    cleanup()
  })

  test('renders user button', () => {
    const { asFragment } = render(<ZiaProvider><Auth /></ZiaProvider>)
    expect(screen.getByRole('button')).toBeDefined()
    expect(asFragment()).toMatchSnapshot();
  })

  test('dev options hidden by default when menu is open', () => {
    render(<ZiaProvider><Auth /></ZiaProvider>)
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('Login')).toBeDefined()
    expect(screen.getByText('Logout')).toBeDefined()
    expect(screen.queryByText('Dev Backend')).toBeNull()
    expect(screen.queryByText('Get Access Key')).toBeNull()
  })

  test('dev options appear when Alt key is pressed', () => {
    render(<ZiaProvider><Auth /></ZiaProvider>)
    fireEvent.click(screen.getByRole('button'))

    expect(screen.queryByText('Dev Backend')).toBeNull()

    fireEvent.keyDown(window, { key: 'Alt' })

    expect(screen.getByText('Dev Backend')).toBeDefined()
    expect(screen.getByText('Get Access Key')).toBeDefined()
    expect(screen.getByText('Prod Backend')).toBeDefined()
  })

  test('dev options appear on Alt press and disappear on release', async () => {
    render(<ZiaProvider><Auth /></ZiaProvider>)
    fireEvent.click(screen.getByRole('button'))

    expect(screen.queryByText('Dev Backend')).toBeNull()

    fireEvent.keyDown(window, { key: 'Alt' })
    expect(screen.getByText('Dev Backend')).toBeDefined()

    fireEvent.keyUp(window, { key: 'Alt' })
    await waitFor(() => {
      expect(screen.queryByText('Dev Backend')).toBeNull()
    })
  })
})
