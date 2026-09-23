import type { ReactElement } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppShell } from './components/app-shell';
import { ComingSoon } from './components/coming-soon';
import { RequireAuth } from './components/require-auth';
import { ROUTES, type ScreenRoute } from './routes';
import { LoginScreen } from './screens/login';
import { SearchScreen } from './screens/search';
import { UploadScreen } from './screens/upload';
import { WorkspaceDocumentsScreen } from './screens/workspace-documents';
import { WorkspacesScreen } from './screens/workspaces';

// The five screens Phase 1 builds. Every other route in `ROUTES` renders `ComingSoon` from the same
// declaration, so adding a screen to the inventory cannot leave a route without a component.
const REAL: Record<string, () => ReactElement> = {
  '/login': LoginScreen,
  '/search': SearchScreen,
  '/workspaces': WorkspacesScreen,
  '/workspaces/:workspaceId': WorkspaceDocumentsScreen,
  '/workspaces/:workspaceId/upload': UploadScreen,
};

function elementFor(route: ScreenRoute) {
  const Screen = REAL[route.path];
  return Screen === undefined ? <ComingSoon route={route} /> : <Screen />;
}

// `/login` is the only route outside the shell: a person who is not signed in has no navigation to
// show, and rendering the sidebar around a sign-in form would offer links that all bounce back.
const inShell = ROUTES.filter((route) => route.path !== '/login');

const children: RouteObject[] = inShell.map((route) => ({
  path: route.path,
  element: elementFor(route),
}));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginScreen /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [...children, { path: '/', element: <Navigate to="/search" replace /> }],
  },
  // Design §8.1 has no "not found" screen, and a typed URL must still land somewhere honest.
  { path: '*', element: <Navigate to="/search" replace /> },
]);
