import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { server } from './server';

// The real @react-oauth/google SDK needs the Google Identity Services script
// (network fetch + window.google) — replace it with a deterministic double so
// login flows are testable in jsdom. The factory only references a module
// specifier, which keeps the hoisted vi.mock free of out-of-scope variables.
vi.mock('@react-oauth/google', () => import('./mocks/googleOAuth'));

// jsdom does not implement matchMedia; the theme context reads it to resolve
// the OS dark-mode preference. Default to light so system-mode tests are
// deterministic.
const matchMediaStub = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
});

if (window.matchMedia === undefined) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMediaStub,
  });
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});