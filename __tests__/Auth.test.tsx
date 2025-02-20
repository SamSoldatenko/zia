import { expect, test, vitest } from 'vitest'
import { render, screen } from '@testing-library/react'
import Auth from '../app/ui/Auth'
import { ZiaProvider } from '@/app/ui/ZiaContext'

test('Auth component rendering', () => {
  const { asFragment } = render(<ZiaProvider><Auth /></ZiaProvider>)
  expect(screen.getByRole('button')).toBeDefined()
  expect(asFragment()).toMatchSnapshot();
})
