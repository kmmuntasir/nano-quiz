import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { vi } from 'vitest';
import StartQuizButton from './StartQuizButton';
import type { Quiz } from '../api/types';
import { server } from '../test/server';

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
    render(<StartQuizButton quiz={buildQuiz()} now={NOW} />);

    const button = screen.getByRole('button', { name: 'Start quiz' });
    expect(button).toBeEnabled();
    expect(screen.queryByText(/^(Starts|Ended|Ends in)/)).not.toBeInTheDocument();
  });

  it('should_be_disabled_with_score_reason_when_participated_even_if_ended', () => {
    render(
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
    render(<StartQuizButton quiz={buildQuiz({ canStart: false })} now={NOW} />);

    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeDisabled();
    expect(screen.getByText('Ends in 24 hours')).toBeInTheDocument();
  });

  it('should_be_disabled_with_starts_reason_when_quiz_is_upcoming', () => {
    render(
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
    render(
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

  it('should_show_next_release_notice_and_fire_no_request_when_clicked', async () => {
    const onStartRequest = vi.fn();
    server.use(http.post('/api/quizzes/:id/start', onStartRequest));
    const user = userEvent.setup();
    render(<StartQuizButton quiz={buildQuiz()} now={NOW} />);

    await user.click(screen.getByRole('button', { name: 'Start quiz' }));

    expect(
      screen.getByText('Quiz taking is coming in the next release'),
    ).toBeInTheDocument();
    expect(onStartRequest).not.toHaveBeenCalled();
  });
});
