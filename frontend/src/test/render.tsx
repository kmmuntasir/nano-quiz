import { type ReactElement, type ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter, type RouteObject } from 'react-router-dom'

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    route?: string
    routes?: RouteObject[]
}

function TestProviders({ children, route = '/', routes }: {
    children: ReactNode
    route?: string
    routes?: RouteObject[]
}) {
    const routerProps = routes
        ? { initialEntries: [route], children }
        : { initialEntries: [route], children }

    // Wrapping with MemoryRouter for route-dependent components.
    // Add AuthContext.Provider and GoogleOAuthProvider here once T3 builds them.
    return (
        <MemoryRouter {...routerProps}>
            {children}
        </MemoryRouter>
    )
}

export function renderWithProviders(
    ui: ReactElement,
    options: CustomRenderOptions = {},
) {
    const { route, routes, ...renderOptions } = options

    return render(ui, {
        wrapper: ({ children }) => (
            <TestProviders route={route} routes={routes}>
                {children}
            </TestProviders>
        ),
        ...renderOptions,
    })
}

export { render }
export default renderWithProviders
