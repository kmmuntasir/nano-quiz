import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('redirects unauthenticated visitors to the login page', async () => {
    render(<App />);

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
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });
});
