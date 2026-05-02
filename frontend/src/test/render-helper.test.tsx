import { describe, it, expect } from 'vitest'
import { renderWithProviders } from './render'

function Hello() {
    return <div>Hello Test</div>
}

describe('renderWithProviders', () => {
    it('renders component wrapped in providers', () => {
        const { getByText } = renderWithProviders(<Hello />)
        expect(getByText('Hello Test')).toBeInTheDocument()
    })

    it('accepts custom route', () => {
        const { getByText } = renderWithProviders(<Hello />, { route: '/quiz' })
        expect(getByText('Hello Test')).toBeInTheDocument()
    })
})
