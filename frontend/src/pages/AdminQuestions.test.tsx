import { afterEach, beforeEach, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { AdminQuestion, AdminQuiz, QuestionInput } from '../api/types';
import { server, TEST_USER } from '../test/server';
import { renderApp, seedSession } from '../test/utils';

const QUIZ: AdminQuiz = {
  id: 'qz1',
  title: 'General Knowledge',
  description: null,
  questionCount: 2,
  timeLimitSeconds: 15,
  startAt: '2026-08-01T10:00:00Z',
  endAt: '2026-08-10T10:00:00Z',
  questionBankSize: 2,
  attemptCount: 0,
};

const LOCKED_QUIZ: AdminQuiz = {
  ...QUIZ,
  id: 'qz2',
  attemptCount: 3,
  questionBankSize: 1,
};

const QUESTIONS: AdminQuestion[] = [
  {
    id: 'qu1',
    text: 'Capital of France?',
    options: ['Paris', 'London'],
    correctOpt: 0,
  },
  { id: 'qu2', text: '2 + 2?', options: ['3', '4'], correctOpt: 1 },
];

let createdInputs: QuestionInput[] = [];
let updatedInputs: Array<{ questionId: string; input: QuestionInput }> = [];
let deletedIds: string[] = [];

function mockAdmin(
  quizzes: AdminQuiz[],
  questions: AdminQuestion[],
  quizId = 'qz1',
): void {
  server.use(http.get('/api/admin/quizzes', () => HttpResponse.json(quizzes)));
  server.use(
    http.get(`/api/admin/quizzes/${quizId}/questions`, () =>
      HttpResponse.json(questions),
    ),
  );
}

function mockQuestionError(): void {
  server.use(http.get('/api/admin/quizzes', () => HttpResponse.json([QUIZ])));
  server.use(
    http.get(
      '/api/admin/quizzes/qz1/questions',
      () =>
        new HttpResponse(
          JSON.stringify({
            error: 'INTERNAL_ERROR',
            message: 'Something went wrong.',
          }),
          {
            status: 500,
          },
        ),
    ),
  );
}

function mockCreateQuestion(): void {
  server.use(
    http.post('/api/admin/quizzes/qz1/questions', async ({ request }) => {
      const input = (await request.json()) as QuestionInput;
      createdInputs.push(input);
      return HttpResponse.json<AdminQuestion>({
        id: 'qu-new',
        ...input,
      });
    }),
  );
}

function mockUpdateQuestion(): void {
  server.use(
    http.put(
      '/api/admin/quizzes/qz1/questions/:questionId',
      async ({ params, request }) => {
        const input = (await request.json()) as QuestionInput;
        updatedInputs.push({ questionId: String(params.questionId), input });
        return HttpResponse.json<AdminQuestion>({
          id: String(params.questionId),
          ...input,
        });
      },
    ),
  );
}

function mockDeleteQuestion(): void {
  server.use(
    http.delete(
      '/api/admin/quizzes/qz1/questions/:questionId',
      ({ params }) => {
        deletedIds.push(String(params.questionId));
        return new HttpResponse(null, { status: 204 });
      },
    ),
  );
}

function mockCreateConflict(): void {
  server.use(
    http.post(
      '/api/admin/quizzes/qz1/questions',
      () =>
        new HttpResponse(
          JSON.stringify({
            error: 'QUIZ_LOCKED',
            message: 'Quiz has attempts.',
          }),
          { status: 409 },
        ),
    ),
  );
}

function renderQuestionsPage(path: string): void {
  window.history.replaceState({}, '', path);
  seedSession({ token: 'test-app-jwt', user: { ...TEST_USER, isAdmin: true } });
  renderApp();
}

function getAddForm(): HTMLElement {
  return screen
    .getByRole('button', { name: 'Add question' })
    .closest('form') as HTMLElement;
}

beforeEach(() => {
  createdInputs = [];
  updatedInputs = [];
  deletedIds = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminQuestions', () => {
  it('should_render_header_status_and_correct_option_when_quiz_loaded', async () => {
    mockAdmin([QUIZ], QUESTIONS);

    renderQuestionsPage('/admin/quizzes/qz1/questions');

    expect(await screen.findByText('General Knowledge')).toBeInTheDocument();
    expect(screen.getByText('2/2 questions')).toBeInTheDocument();
    expect(screen.getByText('Playable')).toBeInTheDocument();
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    const correctParis = screen.getByText('Paris').closest('li');
    expect(correctParis).toHaveTextContent('Correct');
    expect(screen.getByText('4').closest('li')).toHaveTextContent('Correct');
    expect(screen.getByText('London').textContent).not.toContain('Correct');
    expect(
      screen.getByRole('link', { name: 'Back to quizzes' }),
    ).toHaveAttribute('href', '/admin');
  });

  it('should_show_not_yet_playable_badge_when_bank_is_smaller_than_count', async () => {
    mockAdmin([{ ...QUIZ, questionBankSize: 1 }], QUESTIONS.slice(0, 1));

    renderQuestionsPage('/admin/quizzes/qz1/questions');

    expect(await screen.findByText('1/2 questions')).toBeInTheDocument();
    expect(screen.getByText('Not yet playable')).toBeInTheDocument();
  });

  it('should_add_question_with_dynamic_options_and_refresh_list', async () => {
    mockAdmin([QUIZ], QUESTIONS);
    mockCreateQuestion();

    renderQuestionsPage('/admin/quizzes/qz1/questions');
    await screen.findByText('Capital of France?');

    const form = getAddForm();
    await userEvent.type(
      within(form).getByLabelText('Question text'),
      'Largest ocean?',
    );
    const optionInputs = within(form).getAllByRole('textbox');
    await userEvent.type(optionInputs[1], 'Pacific');
    await userEvent.type(optionInputs[2], 'Atlantic');
    await userEvent.click(
      within(form).getByRole('radio', { name: 'Correct option 1' }),
    );
    await userEvent.click(
      within(form).getByRole('button', { name: 'Add question' }),
    );

    expect(await screen.findByText('Largest ocean?')).toBeInTheDocument();
    expect(createdInputs.length).toBe(1);
    expect(createdInputs[0].text).toBe('Largest ocean?');
    expect(createdInputs[0].options).toEqual(['Pacific', 'Atlantic']);
    expect(createdInputs[0].correctOpt).toBe(0);
    expect(screen.getByText('3/2 questions')).toBeInTheDocument();
    expect(screen.getByText('Pacific').textContent).not.toContain('Correct');
  });

  it('should_enforce_minimum_two_options_when_adding', async () => {
    mockAdmin([QUIZ], QUESTIONS);

    renderQuestionsPage('/admin/quizzes/qz1/questions');
    await screen.findByText('Capital of France?');

    const form = getAddForm();
    expect(within(form).getAllByRole('textbox').length).toBe(3); // text + 2 options
    expect(
      within(form).getByRole('button', { name: 'Remove option 1' }),
    ).toBeDisabled();
    expect(
      within(form).getByRole('button', { name: 'Remove option 2' }),
    ).toBeDisabled();

    await userEvent.click(
      within(form).getByRole('button', { name: 'Add option' }),
    );
    await userEvent.click(
      within(form).getByRole('button', { name: 'Remove option 3' }),
    );
    expect(within(form).getAllByRole('textbox').length).toBe(3);

    await userEvent.type(within(form).getByLabelText('Question text'), 'New?');
    await userEvent.click(
      within(form).getByRole('button', { name: 'Add question' }),
    );

    expect(
      await within(form).findByText('All options must have text.'),
    ).toBeInTheDocument();
    expect(createdInputs).toEqual([]);
  });

  it('should_show_server_error_as_alert_when_create_is_rejected', async () => {
    mockAdmin([QUIZ], QUESTIONS);
    mockCreateConflict();

    renderQuestionsPage('/admin/quizzes/qz1/questions');
    await screen.findByText('Capital of France?');

    const form = getAddForm();
    await userEvent.type(within(form).getByLabelText('Question text'), 'New?');
    await userEvent.type(within(form).getAllByRole('textbox')[1], 'A');
    await userEvent.type(within(form).getAllByRole('textbox')[2], 'B');
    await userEvent.click(
      within(form).getByRole('button', { name: 'Add question' }),
    );

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Quiz has attempts.',
    );
  });

  it('should_save_inline_edit_via_put', async () => {
    mockAdmin([QUIZ], QUESTIONS);
    mockUpdateQuestion();

    renderQuestionsPage('/admin/quizzes/qz1/questions');
    await screen.findByText('Capital of France?');

    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

    const form = screen
      .getByRole('button', { name: 'Save question' })
      .closest('form') as HTMLElement;
    const textInput = within(form).getByLabelText('Question text');
    expect(textInput).toHaveValue('Capital of France?');
    await userEvent.clear(textInput);
    await userEvent.type(textInput, 'Capital of Germany?');
    const optionInputs = within(form).getAllByRole('textbox');
    await userEvent.clear(optionInputs[1]);
    await userEvent.type(optionInputs[1], 'Berlin');
    await userEvent.click(
      within(form).getByRole('button', { name: 'Save question' }),
    );

    expect(await screen.findByText('Capital of Germany?')).toBeInTheDocument();
    expect(updatedInputs).toEqual([
      {
        questionId: 'qu1',
        input: {
          text: 'Capital of Germany?',
          options: ['Berlin', 'London'],
          correctOpt: 0,
        },
      },
    ]);
    expect(screen.getByText('Berlin').closest('li')).toHaveTextContent('Correct');
  });

  it('should_cancel_inline_edit_and_keep_original', async () => {
    mockAdmin([QUIZ], QUESTIONS);

    renderQuestionsPage('/admin/quizzes/qz1/questions');
    await screen.findByText('Capital of France?');

    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Capital of France?')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save question' }),
    ).not.toBeInTheDocument();
  });

  it('should_delete_question_after_confirmation', async () => {
    mockAdmin([QUIZ], QUESTIONS);
    mockDeleteQuestion();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderQuestionsPage('/admin/quizzes/qz1/questions');
    await screen.findByText('Capital of France?');

    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(deletedIds).toEqual(['qu1']);
    expect(await screen.findByText('1/2 questions')).toBeInTheDocument();
    expect(screen.queryByText('Capital of France?')).not.toBeInTheDocument();
  });

  it('should_not_delete_when_confirmation_cancelled', async () => {
    mockAdmin([QUIZ], QUESTIONS);
    mockDeleteQuestion();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderQuestionsPage('/admin/quizzes/qz1/questions');
    await screen.findByText('Capital of France?');

    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    expect(deletedIds).toEqual([]);
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
  });

  it('should_lock_all_mutations_when_quiz_has_attempts', async () => {
    mockAdmin([LOCKED_QUIZ], QUESTIONS.slice(0, 1), 'qz2');

    renderQuestionsPage('/admin/quizzes/qz2/questions');

    expect(
      await screen.findByText('Quiz has attempts — question bank is locked'),
    ).toHaveAttribute('role', 'note');
    expect(
      screen.queryByRole('button', { name: 'Add question' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
  });

  it('should_show_error_and_recover_when_loading_fails', async () => {
    mockQuestionError();

    renderQuestionsPage('/admin/quizzes/qz1/questions');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong while loading the questions.',
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    mockAdmin([QUIZ], QUESTIONS);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Capital of France?')).toBeInTheDocument();
  });

  it('should_show_not_found_when_quiz_is_missing', async () => {
    mockAdmin([], []);

    renderQuestionsPage('/admin/quizzes/qz1/questions');

    expect(
      await screen.findByText('Quiz not found. It may have been deleted.'),
    ).toBeInTheDocument();
  });
});
