import type { ReactNode } from 'react';

// Runtime replacement for @react-oauth/google. The real SDK loads the Google
// Identity Services script over the network and renders via window.google —
// neither exists in jsdom, so login flows are driven through this double.

export interface MockCredentialResponse {
  credential?: string;
}

export interface MockGoogleLoginProps {
  onSuccess: (response: MockCredentialResponse) => void;
  onError: () => void;
}

export function GoogleOAuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function GoogleLogin({ onSuccess }: MockGoogleLoginProps) {
  return (
    <button
      type="button"
      onClick={() => onSuccess({ credential: 'test-google-id-token' })}
    >
      Sign in with Google
    </button>
  );
}