import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

const QuizList = lazy(() => import('./pages/QuizList.tsx'));
const Login = lazy(() => import('./pages/Login.tsx'));
const QuizPlay = lazy(() => import('./pages/QuizPlay.tsx'));
const Completion = lazy(() => import('./pages/Completion.tsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.tsx'));
const Admin = lazy(() => import('./pages/Admin.tsx'));
const AdminQuizForm = lazy(() => import('./pages/AdminQuizForm.tsx'));
const AdminQuestions = lazy(() => import('./pages/AdminQuestions.tsx'));
const AdminLeaderboard = lazy(() => import('./pages/AdminLeaderboard.tsx'));

function PageLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 font-sans dark:bg-slate-950">
      <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <QuizList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/quizzes/:id/play"
                  element={
                    <ProtectedRoute>
                      <QuizPlay />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/quizzes/:id/completion"
                  element={
                    <ProtectedRoute>
                      <Completion />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/quizzes/:id/leaderboard"
                  element={
                    <ProtectedRoute>
                      <Leaderboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Admin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/quizzes/new"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminQuizForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/quizzes/:id/edit"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminQuizForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/quizzes/:id/questions"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminQuestions />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/quizzes/:id/leaderboard"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminLeaderboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
