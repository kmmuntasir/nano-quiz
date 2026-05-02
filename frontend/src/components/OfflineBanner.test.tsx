import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import OfflineBanner from './OfflineBanner'

// Mock the hook
vi.mock('../hooks/useOfflineStatus', () => ({
    useOfflineStatus: vi.fn(),
}))

import { useOfflineStatus } from '../hooks/useOfflineStatus'

const mockUseOfflineStatus = vi.mocked(useOfflineStatus)

describe('OfflineBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('renders nothing when online', () => {
        mockUseOfflineStatus.mockReturnValue(false)
        const { container } = render(<OfflineBanner />)
        expect(container.innerHTML).toBe('')
    })

    it('renders banner when offline', () => {
        mockUseOfflineStatus.mockReturnValue(true)
        render(<OfflineBanner />)
        expect(screen.getByText(/You are offline/)).toBeInTheDocument()
    })

    it('has alert role when visible', () => {
        mockUseOfflineStatus.mockReturnValue(true)
        render(<OfflineBanner />)
        expect(screen.getByRole('alert')).toBeInTheDocument()
    })
})
