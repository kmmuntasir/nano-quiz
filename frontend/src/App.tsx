import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import OfflineBanner from './components/OfflineBanner'
import ProtectedRoute from './components/ProtectedRoute'

const Login = lazy(() => import('./pages/Login'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const QuizContainer = lazy(() => import('./pages/QuizContainer'))
const CompletionScreen = lazy(() => import('./pages/CompletionScreen'))
const Question = lazy(() => import('./pages/Question'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))

function PageLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <ErrorBoundary>
                <OfflineBanner />
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/" element={<Login />} />
                        <Route
                            path="/onboard"
                            element={
                                <ProtectedRoute>
                                    <Onboarding />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/quiz"
                            element={
                                <ProtectedRoute requireEmployeeId>
                                    <QuizContainer />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/quiz/complete"
                            element={
                                <ProtectedRoute
                                    requireEmployeeId
                                    requireQuizCompleted
                                >
                                    <CompletionScreen />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/quiz/:sequence"
                            element={
                                <ProtectedRoute
                                    requireEmployeeId
                                    requireQuizStarted
                                >
                                    <Question />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/leaderboard"
                            element={
                                <ProtectedRoute>
                                    <LeaderboardPage />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </Suspense>
            </ErrorBoundary>
        </BrowserRouter>
    )
}
