import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.tsx';
import { validateEnv } from './env.ts';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Root element #root not found. Check frontend/index.html.');
}

const root = rootElement;

function renderBootError(message: string): void {
  createRoot(root).render(
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-lg border border-red-400/50 bg-red-50 p-6">
        <h1 className="mb-2 text-lg font-semibold text-red-800">NanoQuiz failed to start</h1>
        <p className="text-sm leading-relaxed text-red-700">{message}</p>
      </div>
    </div>,
  );
}

try {
  const env = validateEnv();
  createRoot(root).render(
    <StrictMode>
      <GoogleOAuthProvider clientId={env.googleClientId}>
        <App />
      </GoogleOAuthProvider>
    </StrictMode>,
  );
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'An unknown error occurred while starting NanoQuiz.';
  renderBootError(message);
}
