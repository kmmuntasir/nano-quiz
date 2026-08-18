import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import StartQuizButton from './StartQuizButton';
import type { Quiz, QuizSession } from '../api/types';
import { server } from '../test/server';
import { renderWithAuth } from '../test/utils';

const NOW = new Date('2026-08-18T12:00:00Z');

function buildQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'q1',
    title: 'General Knowledge',
    description: 'Ten quick questions.',
    questionCount: 10,
    timeLimitSeconds: 15,
    startAt: '2026-08-18T00:00:00Z',
    endAt: '2026-08-19T12:00:00Z',
    canStart: true,
    participated: false,
    userScore: null,
    ...overrides,
  };
}

describe('StartQuizButton', () => {
  it('should_be_enabled_with_no_reason_when_quiz_can_start', () => {
    renderWithAuth(<StartQuizButton quiz={buildQuiz()} now={NOW} />);

    const button = screen.getByRole('button', { name: 'Start quiz' });
    expect(button).toBeEnabled();
    expect(screen.queryByText(/^(Starts|Ended|Ends in)/)).not.toBeInTheDocument();
  });

  it('should_be_disabled_with_score_reason_when_participated_even_if_ended', () => {
    renderWithAuth(
      <StartQuizButton
        quiz={buildQuiz({
          participated: true,
          canStart: false,
          userScore: 7,
          startAt: '2026-08-10T00:00:00Z',
          endAt: '2026-08-15T00:00:00Z',
        })}
        now={NOW}
      />,
    );

    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeDisabled();
    expect(screen.getByText('You scored 7/10')).toBeInTheDocument();
    expect(screen.queryByText(/^Ended/)).not.toBeInTheDocument();
  });

  it('should_be_disabled_with_ends_in_reason_when_quiz_is_live_but_not_startable', () => {
    renderWithAuth(<StartQuizButton quiz={buildQuiz({ canStart: false })} now={NOW} />);

    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeDisabled();
    expect(screen.getByText('Ends in 24 hours')).toBeInTheDocument();
  });

  it('should_be_disabled_with_starts_reason_when_quiz_is_upcoming', () => {
    renderWithAuth(
      <StartQuizButton
        quiz={buildQuiz({
          canStart: false,
          startAt: '2026-08-20T00:00:00Z',
          endAt: '2026-08-21T00:00:00Z',
        })}
        now={NOW}
      />,
    );

    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeDisabled();
    expect(screen.getByText('Starts Aug 20')).toBeInTheDocument();
  });

  it('should_be_disabled_with_ended_reason_when_quiz_window_has_passed', () => {
    renderWithAuth(
      <StartQuizButton
        quiz={buildQuiz({
          canStart: false,
          startAt: '2026-08-10T00:00:00Z',
          endAt: '2026-08-15T00:00:00Z',
        })}
        now={NOW}
      />,
    );

    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeDisabled();
    expect(screen.getByText('Ended Aug 15')).toBeInTheDocument();
  });

  it('should_be_enabled_with_preview_label_when_admin_and_quiz_ended', () => {
    renderWithAuth(
      <StartQuizButton
        quiz={buildQuiz({
          canStart: true,
          participated: false,
          startAt: '2026-08-10T00:00:00Z',
          endAt: '2026-08-15T00:00:00Z',
        })}
        now={NOW}
      />,
      { isAdmin: true },
    );

    expect(screen.getByRole('button', { name: 'Preview quiz' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Start quiz' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^(Starts|Ended|Ends in)/)).not.toBeInTheDocument();
  });

  it('should_be_disabled_with_reason_when_admin_and_insufficient_bank', () => {
    renderWithAuth(
      <StartQuizButton
        quiz={buildQuiz({
          canStart: false,
          participated: false,
          startAt: '2026-08-10T00:00:00Z',
          endAt: '2026-08-15T00:00:00Z',
        })}
        now={NOW}
      />,
      { isAdmin: true },
    );

    expect(screen.getByRole('button', { name: 'Preview quiz' })).toBeDisabled();
    expect(screen.getByText('Ended Aug 15')).toBeInTheDocument();
  });

  it('should_be_disabled_with_ended_reason_when_non_admin_and_quiz_ended', () => {
    renderWithAuth(
      <StartQuizButton
        quiz={buildQuiz({
          canStart: false,
          startAt: '2026-08-10T00:00:00Z',
          endAt: '2026-08-15T00:00:00Z',
        })}
        now={NOW}
      />,
    );

    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeDisabled();
    expect(screen.getByText('Ended Aug 15')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview quiz' })).not.toBeInTheDocument();
  });

  it('should_call_onStarted_with_session_when_start_succeeds', async () => {
    const session: QuizSession = {
      seed: 'seed-1',
      quizId: 'q1',
      questionCount: 10,
      timeLimitSeconds: 15,
    };
    server.use(
      http.post('/api/quizzes/q1/start', () => HttpResponse.json(session)),
    );
    const onStarted = vi.fn();
    const user = userEvent.setup();
    renderWithAuth(<StartQuizButton quiz={buildQuiz()} now={NOW} onStarted={onStarted} />);

    await user.click(screen.getByRole('button', { name: 'Start quiz' }));
    await user.click(screen.getByRole('button', { name: 'Yes' }));

    expect(onStarted).toHaveBeenCalledWith(session);
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeEnabled();
  });

  it('should_show_error_and_disable_when_start_returns_409', async () => {
    server.use(
      http.post('/api/quizzes/q1/start', () =>
        HttpResponse.json(
          { error: 'ALREADY_PARTICIPATED', message: 'You have already taken this quiz.' },
          { status: 409 },
        ),
      ),
    );
    const onStarted = vi.fn();
    const user = userEvent.setup();
    renderWithAuth(<StartQuizButton quiz={buildQuiz()} now={NOW} onStarted={onStarted} />);

    await user.click(screen.getByRole('button', { name: 'Start quiz' }));
    await user.click(screen.getByRole('button', { name: 'Yes' }));

    expect(onStarted).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('You have already taken this quiz.');
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeDisabled();
  });

  it('should_show_dialog_with_exact_message_when_start_clicked', async () => {
    const user = userEvent.setup();
    renderWithAuth(
      <StartQuizButton quiz={buildQuiz({ questionCount: 5, timeLimitSeconds: 20 })} now={NOW} />,
    );

    await user.click(screen.getByRole('button', { name: 'Start quiz' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This quiz contains 5 questions, each has a time limit of 20 seconds. Are you ready?',
      ),
    ).toBeInTheDocument();
  });

  it('should_show_dialog_when_admin_clicks_preview', async () => {
    const user = userEvent.setup();
    renderWithAuth(<StartQuizButton quiz={buildQuiz()} now={NOW} />, { isAdmin: true });

    await user.click(screen.getByRole('button', { name: 'Preview quiz' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should_not_fire_post_and_close_dialog_when_no_clicked', async () => {
    const postSpy = vi.fn();
    server.use(http.post('/api/quizzes/q1/start', postSpy));
    const onStarted = vi.fn();
    const user = userEvent.setup();
    renderWithAuth(<StartQuizButton quiz={buildQuiz()} now={NOW} onStarted={onStarted} />);

    await user.click(screen.getByRole('button', { name: 'Start quiz' }));
    await user.click(screen.getByRole('button', { name: 'No' }));

    expect(postSpy).not.toHaveBeenCalled();
    expect(onStarted).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeEnabled();
  });

  it('should_close_dialog_as_cancel_when_escape_pressed', async () => {
    const postSpy = vi.fn();
    server.use(http.post('/api/quizzes/q1/start', postSpy));
    const user = userEvent.setup();
    renderWithAuth(<StartQuizButton quiz={buildQuiz()} now={NOW} />);

    await user.click(screen.getByRole('button', { name: 'Start quiz' }));
    await user.keyboard('{Escape}');

    expect(postSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
