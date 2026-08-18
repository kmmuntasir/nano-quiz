import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { Quiz } from '../api/types';
import { server } from '../test/server';
import { renderApp, seedSession } from '../test/utils';

// Contract-level fixtures: fields only, no answer key ever leaves the server.
const FIXTURES: Quiz[] = [
  {
    id: 'q-live',
    title: 'General Knowledge',
    description: 'Ten quick questions.',
    questionCount: 10,
    timeLimitSeconds: 15,
    startAt: '2026-08-18T00:00:00Z',
    endAt: '2026-08-19T12:00:00Z',
    canStart: true,
    participated: false,
    userScore: null,
  },
  {
    id: 'q-upcoming',
    title: 'Science Round',
    description: 'Physics and chemistry.',
    questionCount: 8,
    timeLimitSeconds: 20,
    startAt: '2026-08-20T00:00:00Z',
    endAt: '2026-08-21T00:00:00Z',
    canStart: false,
    participated: false,
    userScore: null,
  },
  {
    id: 'q-participated',
    title: 'History Blitz',
    description: 'Already played.',
    questionCount: 10,
    timeLimitSeconds: 15,
    startAt: '2026-08-10T00:00:00Z',
    endAt: '2026-08-15T00:00:00Z',
    canStart: false,
    participated: true,
    userScore: 7,
  },
];

function mockQuizzes(quizzes: Quiz[]): void {
  server.use(http.get('/api/quizzes', () => HttpResponse.json(quizzes)));
}

async function renderQuizList(): Promise<void> {
  window.history.replaceState({}, '', '/');
  seedSession();
  renderApp();
}

describe('QuizList', () => {
  it('should_render_cards_in_server_order_when_quizzes_exist', async () => {
    mockQuizzes(FIXTURES);
    await renderQuizList();

    const titles = await screen.findAllByRole('heading');
    expect(titles.map((heading) => heading.textContent)).toEqual([
      'General Knowledge',
      'Science Round',
      'History Blitz',
    ]);
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.getAllByText('You scored 7/10').length).toBeGreaterThan(0);
  });

  it('should_show_empty_state_when_no_quizzes_exist', async () => {
    mockQuizzes([]);
    await renderQuizList();

    expect(await screen.findByText('No quizzes yet')).toBeInTheDocument();
  });

  it('should_show_error_message_when_fetch_fails', async () => {
    server.use(
      http.get('/api/quizzes', () =>
        HttpResponse.json(
          { error: 'INTERNAL_ERROR', message: 'Could not load quizzes.' },
          { status: 500 },
        ),
      ),
    );
    await renderQuizList();

    expect(await screen.findByText('Could not load quizzes.')).toBeInTheDocument();
  });

  it('should_refetch_and_render_list_when_retry_clicked_after_error', async () => {
    server.use(
      http.get('/api/quizzes', () =>
        HttpResponse.json(
          { error: 'INTERNAL_ERROR', message: 'Could not load quizzes.' },
          { status: 500 },
        ),
      ),
    );
    await renderQuizList();
    expect(await screen.findByText('Could not load quizzes.')).toBeInTheDocument();

    mockQuizzes(FIXTURES);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'General Knowledge' })).toBeInTheDocument();
    expect(screen.queryByText('Could not load quizzes.')).not.toBeInTheDocument();
  });

  it('should_show_loading_skeleton_while_fetch_is_in_flight', async () => {
    server.use(
      http.get('/api/quizzes', async () => {
        // Never resolves — keeps the list in the loading state for the assertion.
        await new Promise<void>(() => undefined);
        return HttpResponse.json(FIXTURES);
      }),
    );
    await renderQuizList();

    expect(screen.getByLabelText('Loading quizzes')).toBeInTheDocument();
  });

  it('should_refetch_when_tab_becomes_visible_again', async () => {
    mockQuizzes([FIXTURES[0]]);
    await renderQuizList();
    expect(await screen.findByRole('heading', { name: 'General Knowledge' })).toBeInTheDocument();

    mockQuizzes(FIXTURES);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(await screen.findByRole('heading', { name: 'Science Round' })).toBeInTheDocument();
  });
});
