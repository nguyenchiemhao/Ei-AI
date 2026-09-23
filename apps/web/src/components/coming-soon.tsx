import { PLANNED_FEATURES } from '@ei-ai/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Clock, Lock } from 'lucide-react';
import { ApiError, api } from '../lib/api-client';
import type { ScreenRoute } from '../routes';
import { useAuth } from '../state/auth.store';

// The screen asks the server what it is allowed to see, and shows the answer. A Member who types
// /admin/users receives 403 from the API — not a blank page from the router, and not a placeholder
// that quietly pretends the screen is merely unfinished.
function ServerAnswer({ probe }: { probe: string }) {
  const answer = useQuery({
    queryKey: ['probe', probe],
    queryFn: () => api.get(probe),
    retry: false,
  });

  if (answer.isPending) return null;
  const error = answer.error;
  if (!(error instanceof ApiError)) return null;

  if (error.code === 'AUTHZ_ROLE_FORBIDDEN' || error.code === 'AUTHZ_WORKSPACE_FORBIDDEN') {
    return (
      <p
        role="alert"
        data-testid="server-refusal"
        className="mt-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
      >
        <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong className="font-medium">{error.status} {error.code}</strong> — your role may not
          use this screen. The server refused; nothing here was hidden by the browser.
        </span>
      </p>
    );
  }
  return (
    <p data-testid="server-stub" className="mt-6 text-xs text-muted-foreground">
      The endpoint answers <code>{error.status} {error.code}</code> until the feature lands.
    </p>
  );
}

// A described placeholder rather than a dead link: what the screen will do, and when it arrives.
// The phase comes from `GET /me`, so an operator who changes a feature flag changes this panel
// without a deploy; `PLANNED_FEATURES` is the same table's static default, used before sign-in.
export function ComingSoon({ route }: { route: ScreenRoute }) {
  const me = useAuth((state) => state.me);
  const statuses = me?.featureStatus ?? PLANNED_FEATURES;
  const planned = route.feature === undefined ? undefined : statuses[route.feature];

  return (
    <section className="mx-auto max-w-2xl px-6 py-16" data-testid="coming-soon">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock aria-hidden className="h-4 w-4" />
        <span className="text-xs font-medium tracking-wide uppercase">
          {planned === undefined ? 'Planned' : `Arrives in phase ${planned.plannedPhase}`}
        </span>
      </div>
      <h1 className="mt-3 text-2xl font-semibold">{route.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{route.summary}</p>
      {planned !== undefined && (
        <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
          Built by the <code>{planned.module}</code> module, planned for phase{' '}
          {planned.plannedPhase}. This screen is listed now so the navigation is complete and
          nothing here is a dead link.
        </p>
      )}
      {route.probe !== undefined && <ServerAnswer probe={route.probe} />}
    </section>
  );
}
