interface ErrorMessageProps {
    message?: string
    onRetry?: () => void
    retryLabel?: string
}

export default function ErrorMessage({
    message = 'Something went wrong. Please try again.',
    onRetry,
    retryLabel = 'Retry',
}: ErrorMessageProps) {
    return (
        <div role="alert" className="text-center max-w-md mx-auto px-4 py-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <p className="text-red-700 mb-4">{message}</p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="px-5 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                        {retryLabel}
                    </button>
                )}
            </div>
        </div>
    )
}
