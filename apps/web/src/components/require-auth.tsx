import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { restoreSession } from '../lib/session';
import { useAuth } from '../state/auth.store';

// A reload starts with no access token, because the token is never stored — so "not signed in" and
// "not asked yet" are different states, and only the second one may redirect. Sending a reloading
// user to /login before the refresh cookie has been tried would sign them out on every refresh.
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuth((state) => state.status);

  useEffect(() => {
    if (status === 'unknown') void restoreSession();
  }, [status]);

  if (status === 'unknown') {
    return <div className="p-8 text-sm text-muted-foreground">Signing in…</div>;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
