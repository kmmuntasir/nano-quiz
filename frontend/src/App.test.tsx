import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the NanoQuiz placeholder', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'NanoQuiz' })).toBeInTheDocument();
  });
});