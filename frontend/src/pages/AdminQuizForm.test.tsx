import { afterEach, beforeEach, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { AdminQuiz, QuizInput } from '../api/types';
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
    startAt: '2026-08-01T10:00:00.000Z',
    endAt: '2026-08-10T10:00:00.000Z',
    questionBankSize: 7,
    attemptCount: 0,
  },
];

const CREATE_PATH = '/api/admin/quizzes';

let createBody: QuizInput | null = null;
let updateBody: QuizInput | null = null;
let updateId: string | null = null;

const createdQuiz: AdminQuiz = {
  id: 'q-new',
  title: 'Brand New Quiz',
  description: null,
  questionCount: 3,
  timeLimitSeconds: 15,
  startAt: '2026-09-01T10:00:00.000Z',
  endAt: '2026-09-02T10:00:00.000Z',
  questionBankSize: 0,
  attemptCount: 0,
};

function mockQuizzes(): void {
  server.use(http.get('/api/admin/quizzes', () => HttpResponse.json(FIXTURES)));
}

function mockCreate(): void {
  server.use(
    http.post(CREATE_PATH, async ({ request }) => {
      createBody = (await request.json()) as QuizInput;
      return HttpResponse.json(createdQuiz, { status: 201 });
    }),
  );
}

function mockUpdate(): void {
  server.use(
    http.put('/api/admin/quizzes/:id', async ({ request, params }) => {
      updateId = String(params.id);
      updateBody = (await request.json()) as QuizInput;
      return HttpResponse.json({ ...FIXTURES[0], ...(await Promise.resolve(updateBody)) });
    }),
  );
}

function mockConflict(): void {
  server.use(
    http.post(
      CREATE_PATH,
      () =>
        new HttpResponse(
          JSON.stringify({
            error: 'QUIZ_HAS_ATTEMPTS',
            message: 'Quiz has attempts and cannot be edited.',
          }),
          { status: 409 },
        ),
    ),
  );
}

function renderAt(path: string): void {
  window.history.replaceState({}, '', path);
  seedSession({ token: 'test-app-jwt', user: { ...TEST_USER, isAdmin: true } });
  renderApp();
}

async function fillValidCreateForm(): Promise<void> {
  await userEvent.type(await screen.findByLabelText('Title'), 'Brand New Quiz');
  await userEvent.type(screen.getByLabelText('Question count'), '3');
}

beforeEach(() => {
  createBody = null;
  updateBody = null;
  updateId = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminQuizForm', () => {
  it('should_create_quiz_and_navigate_to_admin_when_form_is_valid', async () => {
    mockQuizzes();
    mockCreate();
    renderAt('/admin/quizzes/new');

    await fillValidCreateForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save quiz' }));

    expect(await screen.findByText('Manage quizzes')).toBeInTheDocument();
    expect(createBody).toEqual({
      title: 'Brand New Quiz',
      description: null,
      questionCount: 3,
      timeLimitSeconds: 15,
      startAt: expect.any(String) as string,
      endAt: expect.any(String) as string,
    });
    expect(createBody !== null && createBody.endAt > createBody.startAt).toBe(true);
  });

  it('should_prefill_from_list_fetch_and_submit_update_when_editing', async () => {
    mockQuizzes();
    mockUpdate();
    renderAt('/admin/quizzes/q1/edit');

    const title = await screen.findByLabelText('Title');
    expect(title).toHaveValue('General Knowledge');
    expect(screen.getByLabelText('Question count')).toHaveValue(5);
    expect(screen.getByLabelText('Time limit (seconds)')).toHaveValue(15);

    await userEvent.clear(title);
    await userEvent.type(title, 'Renamed Quiz');
    await userEvent.click(screen.getByRole('button', { name: 'Save quiz' }));

    expect(await screen.findByText('Manage quizzes')).toBeInTheDocument();
    expect(updateId).toBe('q1');
    expect(updateBody).not.toBeNull();
    expect(updateBody?.title).toBe('Renamed Quiz');
    expect(updateBody?.questionCount).toBe(5);
  });

  it('should_block_submit_when_title_is_empty', async () => {
    renderAt('/admin/quizzes/new');

    await userEvent.type(screen.getByLabelText('Question count'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Save quiz' }));

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(createBody).toBeNull();
    expect(window.location.pathname).toBe('/admin/quizzes/new');
  });

  it('should_block_submit_when_question_count_is_not_positive', async () => {
    renderAt('/admin/quizzes/new');

    await userEvent.type(screen.getByLabelText('Title'), 'Zero quiz');
    await userEvent.type(screen.getByLabelText('Question count'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Save quiz' }));

    expect(await screen.findByText('Question count must be a positive integer.')).toBeInTheDocument();
    expect(createBody).toBeNull();
  });

  it('should_block_submit_when_end_at_is_not_after_start_at', async () => {
    renderAt('/admin/quizzes/new');

    await fillValidCreateForm();
    await userEvent.clear(screen.getByLabelText('Ends at'));
    await userEvent.type(screen.getByLabelText('Ends at'), '2020-01-01T10:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save quiz' }));

    expect(await screen.findByText('End time must be after start time.')).toBeInTheDocument();
    expect(createBody).toBeNull();
  });

  it('should_show_alert_when_server_rejects_with_conflict', async () => {
    mockConflict();
    renderAt('/admin/quizzes/new');

    await fillValidCreateForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save quiz' }));

    expect(await screen.findByText('Quiz has attempts and cannot be edited.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save quiz' })).toBeEnabled();
  });

  it('should_show_not_found_when_quiz_id_is_missing_from_list', async () => {
    mockQuizzes();
    renderAt('/admin/quizzes/missing/edit');

    expect(await screen.findByText(/Quiz not found/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to quizzes' })).toHaveAttribute('href', '/admin');
  });
});
