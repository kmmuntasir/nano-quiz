import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info.componentStack)
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div
                    role="alert"
                    className="min-h-screen flex items-center justify-center bg-surface"
                >
                    <div className="text-center max-w-md mx-auto px-4">
                        <div className="text-6xl mb-4">&#9888;</div>
                        <h1 className="text-2xl font-bold text-primary mb-2">
                            Something went wrong
                        </h1>
                        <p className="text-secondary mb-6">
                            An unexpected error occurred. Please try again.
                        </p>
                        <button
                            onClick={this.handleRetry}
                            className="px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
