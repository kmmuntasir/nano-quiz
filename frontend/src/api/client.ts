import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { AUTH_STORAGE_KEY } from '../contexts/auth';
import type { Quiz, QuizSession } from './types';

const AUTH_PATH = '/auth/google';

// Production serves /api from the same origin; VITE_API_BASE_URL overrides it in dev.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

export const SESSION_EXPIRED_QUERY_PARAM = 'sessionExpired';
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

export class ApiError extends Error {
  readonly error: string;
  readonly status: number;

  constructor(error: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.error = error;
    this.status = status;
  }
}

let currentToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  currentToken = token;
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

interface ErrorEnvelope {
  error?: unknown;
  message?: unknown;
}

function toApiError(cause: AxiosError): ApiError {
  const response = cause.response;
  if (response === undefined) {
    return new ApiError('NETWORK_ERROR', 'Network error. Please check your connection.', 0);
  }

  const data = response.data;
  const envelope: ErrorEnvelope =
    typeof data === 'object' && data !== null ? (data as ErrorEnvelope) : {};

  return new ApiError(
    typeof envelope.error === 'string' ? envelope.error : 'REQUEST_FAILED',
    typeof envelope.message === 'string' ? envelope.message : 'Request failed. Please try again.',
    response.status,
  );
}

function isAuthRequest(config: InternalAxiosRequestConfig | undefined): boolean {
  return config?.url?.endsWith(AUTH_PATH) === true;
}

function handleSessionExpired(): void {
  if (currentToken === null) {
    return;
  }
  currentToken = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionExpiredHandler?.();
}

export const apiClient: AxiosInstance = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
  if (currentToken !== null) {
    config.headers.set('Authorization', `Bearer ${currentToken}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const apiError = toApiError(error);
    if (apiError.status === 401 && !isAuthRequest(error.config)) {
      handleSessionExpired();
    }
    return Promise.reject(apiError);
  },
);

export async function fetchQuizzes(): Promise<Quiz[]> {
  const { data } = await apiClient.get<Quiz[]>('/quizzes');
  return data;
}

export async function startQuiz(id: string): Promise<QuizSession> {
  const { data } = await apiClient.post<QuizSession>(`/quizzes/${id}/start`);
  return data;
}