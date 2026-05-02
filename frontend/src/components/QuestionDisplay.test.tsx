import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QuestionDisplay from './QuestionDisplay'
import { ApiError } from '../api/client'

vi.mock('../api/client', () => ({
    default: { get: vi.fn() },
    ApiError: class extends Error {
        status: number
        constructor(message: string, status: number) {
            super(message)
            this.status = status
        }
    },
}))

import api from '../api/client'

const mockQuestion = {
    sequence_order: 3,
    question: 'What year was the company founded?',
    options: { A: '2018', B: '2019', C: '2020', D: '2021' },
}

function renderComponent(overrides: Partial<Parameters<typeof QuestionDisplay>[0]> = {}) {
    const onAnswer = vi.fn()
    const onSequenceMismatch = vi.fn()
    const result = render(
        <QuestionDisplay
            sequence={3}
            onAnswer={onAnswer}
            onSequenceMismatch={onSequenceMismatch}
            {...overrides}
        />,
    )
    return { ...result, onAnswer, onSequenceMismatch }
}

describe('QuestionDisplay', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockResolvedValue({ data: mockQuestion })
    })

    it('shows loading spinner while fetching', () => {
        vi.mocked(api.get).mockImplementation(() => new Promise(() => {}))
        renderComponent()
        expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('fetches question on mount', async () => {
        renderComponent({ sequence: 5 })
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/quiz/question/5')
        })
    })

    it('displays question text', async () => {
        renderComponent()
        await waitFor(() => {
            expect(screen.getByText('What year was the company founded?')).toBeInTheDocument()
        })
    })

    it('displays all 4 answer options', async () => {
        renderComponent()
        await waitFor(() => {
            expect(screen.getByText(/2018/)).toBeInTheDocument()
            expect(screen.getByText(/2019/)).toBeInTheDocument()
            expect(screen.getByText(/2020/)).toBeInTheDocument()
            expect(screen.getByText(/2021/)).toBeInTheDocument()
        })
    })

    it('shows progress indicator', async () => {
        renderComponent({ sequence: 3 })
        await waitFor(() => {
            expect(screen.getByText('Question 3 of 10')).toBeInTheDocument()
        })
    })

    it('shows Next button for non-last question', async () => {
        renderComponent({ sequence: 3 })
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
        })
    })

    it('shows Submit button on question 10', async () => {
        renderComponent({ sequence: 10 })
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
        })
    })

    it('Next/Submit button disabled when no option selected', async () => {
        renderComponent()
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
        })
    })

    it('selecting an option enables the button', async () => {
        renderComponent()
        await waitFor(() => {
            expect(screen.getByText('2019')).toBeInTheDocument()
        })
        fireEvent.click(screen.getByText('2019'))
        expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    })

    it('calls onAnswer with sequence and selected option', async () => {
        const { onAnswer } = renderComponent({ sequence: 3 })
        await waitFor(() => {
            expect(screen.getByText('2020')).toBeInTheDocument()
        })
        fireEvent.click(screen.getByText('2020'))
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(onAnswer).toHaveBeenCalledWith(3, 'C')
    })

    it('shows error on fetch failure', async () => {
        vi.mocked(api.get).mockRejectedValue(new Error('Network error'))
        renderComponent()
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument()
            expect(screen.getByText('Network error')).toBeInTheDocument()
        })
    })

    it('calls onSequenceMismatch on 403', async () => {
        vi.mocked(api.get).mockRejectedValue(new ApiError('Not current question', 403))
        const { onSequenceMismatch } = renderComponent({ sequence: 5 })
        await waitFor(() => {
            expect(onSequenceMismatch).toHaveBeenCalledWith(5)
        })
    })

    it('refetches when sequence changes', async () => {
        const { rerender } = renderComponent({ sequence: 1 })
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/quiz/question/1')
        })
        rerender(
            <QuestionDisplay
                sequence={7}
                onAnswer={vi.fn()}
                onSequenceMismatch={vi.fn()}
            />,
        )
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/quiz/question/7')
        })
    })
})
