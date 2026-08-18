import { useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import {
  ApiError,
  apiClient,
  SESSION_EXPIRED_MESSAGE,
  SESSION_EXPIRED_QUERY_PARAM,
} from '../api/client';
import type { AuthUser } from '../contexts/auth';
import { useAuth } from '../hooks/useAuth';

const INVALID_TOKEN_MESSAGE = 'Sign-in failed. Please try again.';

interface AuthResponse {
  token: string;
  user: AuthUser;
}

interface LoginLocationState {
  from?: Location;
}

type LoginStatus = 'idle' | 'verifying';

function toErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return INVALID_TOKEN_MESSAGE;
  }
  if (error.error === 'INVALID_ID_TOKEN' || error.error === 'VALIDATION_ERROR') {
    return INVALID_TOKEN_MESSAGE;
  }
  return error.message || INVALID_TOKEN_MESSAGE;
}

function getRedirectTarget(location: Location): string {
  const state = location.state as LoginLocationState | null;
  const from = state?.from;
  return from === undefined ? '/' : `${from.pathname}${from.search}${from.hash}`;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirectTarget = getRedirectTarget(location);
  const showSessionExpired =
    new URLSearchParams(location.search).get(SESSION_EXPIRED_QUERY_PARAM) === '1';

  async function handleLoginSuccess(response: CredentialResponse): Promise<void> {
    const idToken = response.credential;
    if (idToken === undefined) {
      return;
    }
    setStatus('verifying');
    setErrorMessage(null);
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/google', { idToken });
      signIn(data.token, data.user);
      navigate(redirectTarget, { replace: true });
    } catch (error) {
      setStatus('idle');
      setErrorMessage(toErrorMessage(error));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 p-page font-sans dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-card shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="mb-1 text-center text-2xl font-bold text-brand-700 dark:text-brand-300">
          NanoQuiz
        </h1>
        <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Sign in to play
        </p>
        {showSessionExpired ? (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {SESSION_EXPIRED_MESSAGE}
          </p>
        ) : null}
        {status === 'verifying' ? (
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-slate-100 px-4 py-2.5 font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          >
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-200"
            />
            Signing in…
          </button>
        ) : (
          <GoogleLogin
            onSuccess={(response) => void handleLoginSuccess(response)}
            onError={() => undefined}
            width="100%"
            size="large"
            shape="rectangular"
            text="signin_with"
            containerProps={{ className: 'w-full' }}
          />
        )}
        {errorMessage !== null ? (
          <p role="alert" className="mt-4 text-center text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
