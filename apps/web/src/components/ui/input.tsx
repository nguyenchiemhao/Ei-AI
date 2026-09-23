import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm',
        'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary',
        className,
      )}
      {...props}
    />
  );
}
