import { screen } from '@testing-library/react';
import QuizCard from './QuizCard';
import type { Quiz } from '../api/types';
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

describe('QuizCard', () => {
  it('should_render_title_description_and_meta_when_quiz_is_live', () => {
    renderWithAuth(<QuizCard quiz={buildQuiz()} now={NOW} />);

    expect(screen.getByRole('heading', { name: 'General Knowledge' })).toBeInTheDocument();
    expect(screen.getByText('Ten quick questions.')).toBeInTheDocument();
    expect(
      screen.getByText('10 questions · 15s per question · Aug 18 – Aug 19'),
    ).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('should_render_upcoming_badge_when_now_is_before_start_at', () => {
    renderWithAuth(
      <QuizCard
        quiz={buildQuiz({ startAt: '2026-08-20T00:00:00Z', endAt: '2026-08-21T00:00:00Z' })}
        now={NOW}
      />,
    );

    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('should_render_ended_badge_when_now_is_after_end_at', () => {
    renderWithAuth(
      <QuizCard
        quiz={buildQuiz({ startAt: '2026-08-10T00:00:00Z', endAt: '2026-08-15T00:00:00Z' })}
        now={NOW}
      />,
    );

    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  it('should_render_score_line_when_user_participated', () => {
    renderWithAuth(
      <QuizCard
        quiz={buildQuiz({ participated: true, canStart: false, userScore: 7 })}
        now={NOW}
      />,
    );

    // Rendered by both the card score line and the Start button's reason.
    expect(screen.getAllByText('You scored 7/10').length).toBeGreaterThan(0);
  });
});
