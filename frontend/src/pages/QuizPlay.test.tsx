import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { QuizSession } from '../api/types';
import { server } from '../test/server';
import { renderApp, seedSession } from '../test/utils';

const SESSION: QuizSession = {
  seed: 'seed-1',
  quizId: 'q-live',
  questionCount: 2,
  timeLimitSeconds: 15,
};

const SHORT_SESSION: QuizSession = { ...SESSION, timeLimitSeconds: 2 };
const SHORT_TIME_LIMIT_MS = SHORT_SESSION.timeLimitSeconds * 1000;

const QUESTIONS = [
  { seq: 1, total: 2, text: 'First question?', options: ['A1', 'B1', 'C1'] },
  { seq: 2, total: 2, text: 'Second question?', options: ['A2', 'B2', 'C2'] },
];

const SUBMIT_RESULT = {
  score: 50,
  totalQuestions: 2,
  correctCount: 1,
  durationMs: 3000,
  participated: true,
};

interface SubmitPayload {
  seed: string;
  answers: number[];
  elapsedMs: number;
}

function stubQuestions(): void {
  server.use(
    http.get(`/api/quizzes/${SESSION.quizId}/question/:seq`, ({ params }) => {
      const question = QUESTIONS[Number(params.seq) - 1];
      return question ? HttpResponse.json(question) : HttpResponse.json({}, { status: 404 });
    }),
  );
}

function stubSubmit(): SubmitPayload[] {
  const payloads: SubmitPayload[] = [];
  server.use(
    http.post(`/api/quizzes/${SESSION.quizId}/submit`, async ({ request }) => {
      payloads.push((await request.json()) as SubmitPayload);
      return HttpResponse.json(SUBMIT_RESULT);
    }),
  );
  return payloads;
}

function renderAt(path: string, state: unknown): void {
  window.history.replaceState(state, '', path);
  seedSession();
  renderApp();
}

function renderPlay(): void {
  stubQuestions();
  renderAt('/quizzes/q-live/play', { usr: { session: SESSION }, key: 'test', idx: 0 });
}

function renderShortPlay(): void {
  stubQuestions();
  renderAt('/quizzes/q-live/play', { usr: { session: SHORT_SESSION }, key: 'test', idx: 0 });
}

describe('QuizPlay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should_render_first_question_when_location_state_carries_session', async () => {
    renderPlay();

    expect(await screen.findByRole('heading', { name: QUESTIONS[0].text })).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A1' })).toBeInTheDocument();
  });

  it('should_redirect_home_when_location_state_has_no_session', async () => {
    server.use(http.get('/api/quizzes', () => HttpResponse.json([])));
    renderAt('/quizzes/q-live/play', null);

    expect(await screen.findByText('No quizzes yet')).toBeInTheDocument();
    expect(screen.queryByText('1 of 2')).not.toBeInTheDocument();
  });

  it('should_advance_to_next_question_when_option_clicked', async () => {
    const user = userEvent.setup();
    renderPlay();

    await user.click(await screen.findByRole('button', { name: 'A1' }));

    expect(await screen.findByRole('heading', { name: QUESTIONS[1].text })).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: QUESTIONS[0].text })).not.toBeInTheDocument();
  });

  it('should_submit_seed_answers_and_elapsedMs_when_last_question_answered', async () => {
    const payloads = stubSubmit();
    const user = userEvent.setup();
    renderPlay();

    await user.click(await screen.findByRole('button', { name: 'B1' }));
    await user.click(await screen.findByRole('button', { name: 'C2' }));

    expect(await screen.findByText('Quiz complete')).toBeInTheDocument();
    expect(payloads).toHaveLength(1);
    expect(payloads[0].seed).toBe(SESSION.seed);
    expect(payloads[0].answers).toEqual([1, 2]);
    expect(payloads[0].elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('should_show_score_summary_when_submit_succeeds', async () => {
    stubSubmit();
    const user = userEvent.setup();
    renderPlay();

    await user.click(await screen.findByRole('button', { name: 'A1' }));
    await user.click(await screen.findByRole('button', { name: 'A2' }));

    expect(await screen.findByText('Quiz complete')).toBeInTheDocument();
    expect(screen.getByText('You scored 1 of 2')).toBeInTheDocument();
  });

  it('should_auto_retry_and_complete_when_submit_fails_then_succeeds', async () => {
    let failures = 0;
    server.use(
      http.post(`/api/quizzes/${SESSION.quizId}/submit`, () => {
        failures += 1;
        if (failures <= 2) {
          return HttpResponse.error();
        }
        return HttpResponse.json(SUBMIT_RESULT);
      }),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPlay();

    await user.click(await screen.findByRole('button', { name: 'A1' }));
    await user.click(await screen.findByRole('button', { name: 'A2' }));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(failures).toBe(3);
    expect(await screen.findByText('Quiz complete')).toBeInTheDocument();
  });

  it('should_show_manual_retry_when_all_auto_retries_exhausted', async () => {
    let attempts = 0;
    server.use(
      http.post(`/api/quizzes/${SESSION.quizId}/submit`, () => {
        attempts += 1;
        return HttpResponse.error();
      }),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPlay();

    await user.click(await screen.findByRole('button', { name: 'A1' }));
    await user.click(await screen.findByRole('button', { name: 'A2' }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(attempts).toBe(4); // initial + 3 retries
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not save your result. Please retry.',
    );

    stubSubmit();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(await screen.findByText('Quiz complete')).toBeInTheDocument();
  });

  it('should_show_alert_and_retry_when_question_fetch_fails', async () => {
    const user = userEvent.setup();
    stubQuestions();
    // Registered after stubQuestions so this handler wins for seq 1 (last-registered wins in MSW).
    server.use(
      http.get(`/api/quizzes/${SESSION.quizId}/question/1`, () =>
        HttpResponse.json({ error: 'server_error', message: 'Boom' }, { status: 500 }),
      ),
    );
    renderAt('/quizzes/q-live/play', { usr: { session: SESSION }, key: 'test', idx: 0 });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Boom');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    stubQuestions();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: QUESTIONS[0].text })).toBeInTheDocument();
  });

  describe('timer', () => {
    it('should_show_countdown_while_question_displayed', async () => {
      renderPlay();

      expect(await screen.findByRole('timer')).toHaveTextContent('15s');
    });

    it('should_advance_to_next_question_when_question_times_out', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      renderShortPlay();

      await screen.findByRole('heading', { name: QUESTIONS[0].text });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_TIME_LIMIT_MS);
      });

      expect(await screen.findByRole('heading', { name: QUESTIONS[1].text })).toBeInTheDocument();
      expect(screen.getByText('2 of 2')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: QUESTIONS[0].text })).not.toBeInTheDocument();
    });

    it('should_submit_with_timeout_sentinel_when_last_question_times_out', async () => {
      const payloads = stubSubmit();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      renderShortPlay();

      await screen.findByRole('heading', { name: QUESTIONS[0].text });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_TIME_LIMIT_MS);
      });
      await screen.findByRole('heading', { name: QUESTIONS[1].text });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_TIME_LIMIT_MS);
      });

      expect(await screen.findByText('Quiz complete')).toBeInTheDocument();
      expect(payloads).toHaveLength(1);
      expect(payloads[0].answers).toEqual([-1, -1]);
      expect(payloads[0].answers).toHaveLength(SHORT_SESSION.questionCount);
    });

    it('should_not_fire_timeout_after_answer_advances_question', async () => {
      const payloads = stubSubmit();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderShortPlay();

      await user.click(await screen.findByRole('button', { name: 'A1' }));
      expect(await screen.findByRole('heading', { name: QUESTIONS[1].text })).toBeInTheDocument();
      expect(screen.getByRole('timer')).toHaveTextContent('2s');

      // Elapse most (but not all) of the second question's window: no timeout
      // may fire from the first question's canceled countdown.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_TIME_LIMIT_MS - 200);
      });

      expect(screen.getByRole('heading', { name: QUESTIONS[1].text })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'B2' }));

      expect(await screen.findByText('Quiz complete')).toBeInTheDocument();
      expect(payloads[0].answers).toEqual([0, 1]);
    });

    it('should_not_run_timer_while_submit_retry_pending', async () => {
      let attempts = 0;
      server.use(
        http.post(`/api/quizzes/${SESSION.quizId}/submit`, () => {
          attempts += 1;
          return HttpResponse.error();
        }),
      );
      vi.useFakeTimers({ shouldAdvanceTime: true });
      renderShortPlay();

      await screen.findByRole('heading', { name: QUESTIONS[0].text });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_TIME_LIMIT_MS);
      });
      await screen.findByRole('heading', { name: QUESTIONS[1].text });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_TIME_LIMIT_MS);
      });
      // Last-question timeout triggers the submit retry loop; the timer must
      // go inert (submitting) instead of firing again or advancing.
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(attempts).toBe(4); // initial + 3 retries, no extra submit from the timer
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not save your result. Please retry.',
      );
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    });

    it('should_submit_normalized_sparse_answers_when_timeout_and_answer_mixed', async () => {
      const payloads = stubSubmit();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderShortPlay();

      await screen.findByRole('heading', { name: QUESTIONS[0].text });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SHORT_TIME_LIMIT_MS);
      });
      await user.click(await screen.findByRole('button', { name: 'C2' }));

      expect(await screen.findByText('Quiz complete')).toBeInTheDocument();
      expect(payloads[0].answers).toEqual([-1, 2]);
    });
  });
});
