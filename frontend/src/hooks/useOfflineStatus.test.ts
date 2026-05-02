import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOfflineStatus } from './useOfflineStatus'

describe('useOfflineStatus', () => {
    const listeners: Record<string, EventListener[]> = {}

    beforeEach(() => {
        Object.defineProperty(navigator, 'onLine', {
            value: true,
            writable: true,
            configurable: true,
        })
        vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
            if (!listeners[event]) listeners[event] = []
            listeners[event].push(handler as EventListener)
        })
        vi.spyOn(window, 'removeEventListener').mockImplementation((event, handler) => {
            listeners[event] = (listeners[event] || []).filter((h) => h !== handler)
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('returns false when online', () => {
        const { result } = renderHook(() => useOfflineStatus())
        expect(result.current).toBe(false)
    })

    it('returns true when navigator.onLine is false', () => {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
        const { result } = renderHook(() => useOfflineStatus())
        expect(result.current).toBe(true)
    })

    it('updates to true on offline event', () => {
        const { result } = renderHook(() => useOfflineStatus())
        expect(result.current).toBe(false)

        act(() => {
            listeners['offline']?.forEach((fn) => fn(new Event('offline')))
        })

        expect(result.current).toBe(true)
    })

    it('updates to false on online event', () => {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
        const { result } = renderHook(() => useOfflineStatus())
        expect(result.current).toBe(true)

        act(() => {
            listeners['online']?.forEach((fn) => fn(new Event('online')))
        })

        expect(result.current).toBe(false)
    })

    it('cleans up event listeners on unmount', () => {
        const { unmount } = renderHook(() => useOfflineStatus())
        unmount()
        expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function))
        expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function))
    })
})
