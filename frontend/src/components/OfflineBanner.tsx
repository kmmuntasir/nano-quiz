import { useOfflineStatus } from '../hooks/useOfflineStatus'

export default function OfflineBanner() {
    const isOffline = useOfflineStatus()

    if (!isOffline) return null

    return (
        <div
            role="alert"
            className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-center py-2 px-4 z-50"
        >
            You are offline. Some features may be unavailable.
        </div>
    )
}
