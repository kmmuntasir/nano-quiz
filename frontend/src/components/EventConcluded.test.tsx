import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EventConcluded from './EventConcluded'

describe('EventConcluded', () => {
    it('renders event concluded heading', () => {
        render(<EventConcluded />)
        expect(screen.getByText('Event Has Concluded')).toBeInTheDocument()
    })

    it('renders thank you message', () => {
        render(<EventConcluded />)
        expect(screen.getByText(/This quiz event has ended/)).toBeInTheDocument()
    })
})
