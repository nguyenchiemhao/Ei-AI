import { PLANNED_FEATURES } from '@ei-ai/shared-types';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { signOut } from '../lib/session';
import { Button } from './ui/button';
import { cn } from '../lib/cn';
import { ROUTES, type ScreenRoute } from '../routes';
import { useAuth } from '../state/auth.store';
import { FeatureBadge } from './feature-badge';

const GROUPS = [
  { key: 'work', label: 'Work' },
  { key: 'admin', label: 'Administration' },
] as const;

function navItemsOf(group: string): ScreenRoute[] {
  return ROUTES.filter((route) => route.nav?.group === group);
}

// The mode line of FR-79, read from `GET /me`. It is the one place a person can see which of the
// three supported configurations this installation is running.
function ModeLine() {
  const me = useAuth((state) => state.me);
  if (me === null) return null;
  const { documents, web, erp } = me.toolGroups;
  return (
    <p className="px-3 py-2 text-[11px] text-muted-foreground">
      Documents: {documents} · Web search: {web} · ERP: {erp.replace('_', ' ')}
    </p>
  );
}

export function AppShell() {
  const me = useAuth((state) => state.me);
  const navigate = useNavigate();
  const statuses = me?.featureStatus ?? PLANNED_FEATURES;

  return (
    <div className="flex min-h-screen">
      <nav aria-label="Main" className="w-60 shrink-0 border-r border-border bg-muted/40">
        <div className="px-3 py-4 text-sm font-semibold">Ei-AI</div>
        {GROUPS.map((group) => (
          <div key={group.key} className="px-2 py-1">
            <p className="px-1 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </p>
            {navItemsOf(group.key).map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent',
                    isActive && 'bg-accent font-medium',
                  )
                }
              >
                {route.nav?.label}
                <FeatureBadge planned={route.feature ? statuses[route.feature] : undefined} />
              </NavLink>
            ))}
          </div>
        ))}
        <ModeLine />
        {me !== null && (
          <div className="border-t border-border px-3 py-3">
            <p className="text-xs font-medium">{me.user.displayName}</p>
            <p className="text-[11px] text-muted-foreground">{me.user.systemRole}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start px-1"
              onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}
            >
              Sign out
            </Button>
          </div>
        )}
      </nav>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
