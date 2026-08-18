import { afterEach, beforeEach, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { AdminQuiz } from '../api/types';
import { server } from '../test/server';
import { renderApp, seedSession } from '../test/utils';
import { TEST_USER } from '../test/server';

const FIXTURES: AdminQuiz[] = [
  {
    id: 'q1',
    title: 'General Knowledge',
    description: null,
    questionCount: 5,
    timeLimitSeconds: 15,
    startAt: '2026-08-01T10:00:00Z',
    endAt: '2026-08-10T10:00:00Z',
    questionBankSize: 7,
    attemptCount: 0,
  },
  {
    id: 'q2',
    title: 'Science',
    description: null,
    questionCount: 6,
    timeLimitSeconds: 20,
    startAt: '2026-08-01T10:00:00Z',
    endAt: '2026-08-10T10:00:00Z',
    questionBankSize: 3,
    attemptCount: 4,
  },
];

let deleteCalls: string[] = [];

function mockQuizzes(quizzes: AdminQuiz[]): void {
  server.use(http.get('/api/admin/quizzes', () => HttpResponse.json(quizzes)));
}

function mockQuizzesError(): void {
  server.use(
    http.get(
      '/api/admin/quizzes',
      () =>
        new HttpResponse(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Something went wrong.' }), {
          status: 500,
        }),
    ),
  );
}

function mockDelete(): void {
  server.use(http.delete('/api/admin/quizzes/:id', ({ params }) => {
    deleteCalls.push(String(params.id));
    return new HttpResponse(null, { status: 204 });
  }));
}

function renderAdmin(): void {
  window.history.replaceState({}, '', '/admin');
  seedSession({ token: 'test-app-jwt', user: { ...TEST_USER, isAdmin: true } });
  renderApp();
}

beforeEach(() => {
  deleteCalls = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Admin', () => {
  it('should_render_quiz_rows_with_badges_and_attempts_when_quizzes_exist', async () => {
    mockQuizzes(FIXTURES);
    renderAdmin();

    expect(await screen.findByText('General Knowledge')).toBeInTheDocument();
    expect(screen.getByText('Science')).toBeInTheDocument();
    expect(screen.getByText('7/5')).toBeInTheDocument();
    expect(screen.getAllByText('Playable').length).toBe(1);
    expect(screen.getByText('3/6')).toBeInTheDocument();
    expect(screen.getAllByText('Not playable').length).toBe(1);
    expect(screen.getByText('0 attempts')).toBeInTheDocument();
    expect(screen.getByText('4 attempts')).toBeInTheDocument();
    expect(screen.getByText('Editable')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('should_show_loading_skeleton_before_data_arrives', () => {
    mockQuizzes(FIXTURES);
    renderAdmin();

    expect(screen.getByLabelText('Loading quizzes')).toHaveAttribute('aria-busy', 'true');
  });

  it('should_show_alert_and_recover_when_fetch_fails', async () => {
    mockQuizzesError();
    renderAdmin();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    mockQuizzes(FIXTURES);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('General Knowledge')).toBeInTheDocument();
  });

  it('should_show_empty_state_when_no_quizzes', async () => {
    mockQuizzes([]);
    renderAdmin();

    expect(await screen.findByText('No quizzes yet')).toBeInTheDocument();
  });

  it('should_link_new_quiz_and_row_actions', async () => {
    mockQuizzes(FIXTURES);
    renderAdmin();

    expect(await screen.findByRole('link', { name: 'New quiz' })).toHaveAttribute(
      'href',
      '/admin/quizzes/new',
    );
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/admin/quizzes/q1/edit');
    expect(screen.getAllByRole('link', { name: 'Questions' })[0]).toHaveAttribute(
      'href',
      '/admin/quizzes/q1/questions',
    );
    expect(screen.getAllByRole('link', { name: 'Leaderboard' })[0]).toHaveAttribute(
      'href',
      '/admin/quizzes/q1/leaderboard',
    );
  });

  it('should_render_edit_disabled_when_quiz_has_attempts', async () => {
    mockQuizzes(FIXTURES);
    renderAdmin();

    await screen.findByText('Science');

    const lockedEdit = screen.getByTitle('Quiz has attempts — editing locked');
    expect(lockedEdit).toHaveAttribute('aria-disabled', 'true');
    expect(lockedEdit.tagName).not.toBe('A');
    expect(screen.queryAllByRole('link', { name: 'Edit' }).length).toBe(1);
  });

  it('should_delete_quiz_and_remove_row_when_confirmed', async () => {
    mockQuizzes(FIXTURES);
    mockDelete();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAdmin();

    await screen.findByText('General Knowledge');
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteCalls).toEqual(['q1']);
    expect(await screen.findByText('Science')).toBeInTheDocument();
    expect(screen.queryByText('General Knowledge')).not.toBeInTheDocument();
  });

  it('should_not_call_delete_when_confirm_cancelled', async () => {
    mockQuizzes(FIXTURES);
    mockDelete();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAdmin();

    await screen.findByText('General Knowledge');
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    expect(deleteCalls).toEqual([]);
    expect(screen.getByText('General Knowledge')).toBeInTheDocument();
  });

  it('should_redirect_non_admins_away_from_admin_page', async () => {
    mockQuizzes(FIXTURES);
    window.history.replaceState({}, '', '/admin');
    seedSession();
    renderApp();

    expect(screen.queryByText('Manage quizzes')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
