import type { PlannedFeature } from '@ei-ai/shared-types';
import { cn } from '../lib/cn';

// Tidiness, not security: a badge says a screen is not finished. Whether a caller may reach the
// data behind it is the server's decision, and the server makes it on every request.
export function FeatureBadge({ planned }: { planned: PlannedFeature | undefined }) {
  if (planned === undefined) return null;
  return (
    <span
      className={cn(
        'ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium',
        planned.status === 'disabled'
          ? 'bg-muted text-muted-foreground line-through'
          : 'bg-accent text-accent-foreground',
      )}
    >
      {planned.plannedPhase}
    </span>
  );
}
