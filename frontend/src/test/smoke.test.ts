import { describe, it, expect } from 'vitest'

describe('testing infrastructure', () => {
    it('runs vitest with jsdom environment', () => {
        expect(typeof document).toBe('object')
        const el = document.createElement('div')
        expect(el instanceof HTMLElement).toBe(true)
    })

    it('has jest-dom matchers available', () => {
        const div = document.createElement('div')
        div.textContent = 'hello'
        document.body.appendChild(div)
        expect(div).toBeInTheDocument()
        expect(div).toHaveTextContent('hello')
    })
})
