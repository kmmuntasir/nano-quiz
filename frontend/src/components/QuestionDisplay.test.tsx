import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestionDisplay from './QuestionDisplay';
import type { Question } from '../api/types';

function buildQuestion(overrides: Partial<Question> = {}): Question {
  return {
    seq: 2,
    total: 5,
    text: 'What is the capital of France?',
    options: ['Berlin', 'Paris', 'Madrid'],
    ...overrides,
  };
}

describe('QuestionDisplay', () => {
  it('should_render_progress_question_text_and_all_options_when_mounted', () => {
    render(<QuestionDisplay question={buildQuestion()} onAnswer={vi.fn()} />);

    expect(screen.getByText('2 of 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What is the capital of France?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Berlin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paris' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Madrid' })).toBeInTheDocument();
  });

  it('should_call_onAnswer_with_option_index_when_option_clicked', async () => {
    const onAnswer = vi.fn();
    const user = userEvent.setup();
    render(<QuestionDisplay question={buildQuestion()} onAnswer={onAnswer} />);

    await user.click(screen.getByRole('button', { name: 'Paris' }));

    expect(onAnswer).toHaveBeenCalledWith(1);
  });

  it('should_disable_option_buttons_when_disabled_is_true', () => {
    render(<QuestionDisplay question={buildQuestion()} onAnswer={vi.fn()} disabled />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
  });

  it('should_render_no_back_navigation_controls', () => {
    render(<QuestionDisplay question={buildQuestion()} onAnswer={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(buildQuestion().options.length);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/back|previous|next/i)).not.toBeInTheDocument();
  });
});
