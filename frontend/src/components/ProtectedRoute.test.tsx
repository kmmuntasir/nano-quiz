import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { renderApp, seedSession } from '../test/utils';
import { TEST_TOKEN, TEST_USER } from '../test/server';
import ProtectedRoute from './ProtectedRoute';

const HOME_LABEL = 'home-route';
const LOGIN_LABEL = 'login-route';
const ADMIN_CONTENT = 'admin-content';

function renderRoutes(requireAdmin: boolean): void {
  renderApp(
    <MemoryRouter initialEntries={['/admin']}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<div>{HOME_LABEL}</div>} />
          <Route path="/login" element={<div>{LOGIN_LABEL}</div>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin={requireAdmin}>
                <div>{ADMIN_CONTENT}</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('should_render_children_when_admin_and_require_admin_is_set', () => {
    seedSession({ token: TEST_TOKEN, user: { ...TEST_USER, isAdmin: true } });
    renderRoutes(true);

    expect(screen.getByText(ADMIN_CONTENT)).toBeInTheDocument();
  });

  it('should_redirect_to_home_when_non_admin_and_require_admin_is_set', () => {
    seedSession();
    renderRoutes(true);

    expect(screen.getByText(HOME_LABEL)).toBeInTheDocument();
  });

  it('should_redirect_to_login_when_token_is_missing_regardless_of_require_admin', () => {
    localStorage.clear();
    renderRoutes(true);

    expect(screen.getByText(LOGIN_LABEL)).toBeInTheDocument();
  });

  it('should_render_children_when_non_admin_and_require_admin_is_not_set', () => {
    seedSession();
    renderRoutes(false);

    expect(screen.getByText(ADMIN_CONTENT)).toBeInTheDocument();
  });
});
