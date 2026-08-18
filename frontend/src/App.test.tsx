import { render, screen } from '@testing-library/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';

function renderApp(): void {
  render(
    <GoogleOAuthProvider clientId="test-client-id">
      <App />
    </GoogleOAuthProvider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('redirects unauthenticated visitors to the login page', async () => {
    renderApp();

    expect(await screen.findByRole('heading', { name: 'NanoQuiz' })).toBeInTheDocument();
  });

  it('renders the home page for an authenticated visitor', async () => {
    localStorage.setItem(
      'nanoquiz.auth',
      JSON.stringify({
        token: 'test-token',
        user: { id: '1', name: 'Test User', email: 'test@example.com', isAdmin: false },
      }),
    );
    renderApp();

    expect(await screen.findByText('Your quiz list will appear here')).toBeInTheDocument();
  });
});
