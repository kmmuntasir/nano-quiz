import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AUTH_STORAGE_KEY } from '../contexts/auth';
import { THEME_STORAGE_KEY } from '../contexts/theme';
import { renderApp, seedSession } from '../test/utils';

async function renderAuthedHome(): Promise<void> {
  seedSession();
  renderApp();
  await screen.findByText('No quizzes yet');
}

describe('TopBar', () => {
  it('should_clear_session_and_return_to_login_when_sign_out_is_clicked', async () => {
    const user = userEvent.setup();
    await renderAuthedHome();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'NanoQuiz' })).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('should_cycle_light_dark_system_and_persist_theme_when_toggle_is_clicked', async () => {
    const user = userEvent.setup();
    await renderAuthedHome();

    const toggle = screen.getByRole('button', { name: 'Toggle theme' });

    await user.click(toggle);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    await user.click(toggle);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await user.click(toggle);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});