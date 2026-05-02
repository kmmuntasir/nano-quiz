import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
    const { login, isAuthenticated, hasOnboarded } = useAuth()
    const navigate = useNavigate()
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    if (isAuthenticated) {
        navigate(hasOnboarded ? '/quiz' : '/onboard', { replace: true })
        return null
    }

    const handleSuccess = async (credential: string) => {
        setError(null)
        setLoading(true)

        try {
            const onboardingRequired = await login(credential)
            navigate(onboardingRequired ? '/onboard' : '/quiz', { replace: true })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="bg-surface-card rounded-xl shadow-lg p-8 max-w-sm w-full text-center">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-primary">NanoQuiz</h1>
                    <p className="text-text-secondary mt-2">Sign in to start the quiz</p>
                </div>

                <div className="flex justify-center">
                    <GoogleLogin
                        onSuccess={(response) => {
                            if (response.credential) {
                                handleSuccess(response.credential)
                            } else {
                                setError('Google login failed. Please try again.')
                            }
                        }}
                        onError={() => {
                            setError('Google login failed. Please try again.')
                        }}
                        disabled={loading}
                        text={loading ? 'Signing in...' : 'signin_with'}
                        shape="rectangular"
                        size="large"
                        width="300"
                    />
                </div>

                {error && (
                    <p className="mt-4 text-sm text-error">{error}</p>
                )}
            </div>
        </div>
    )
}
