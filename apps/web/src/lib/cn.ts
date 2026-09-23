import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn/ui's class helper: clsx resolves conditionals, tailwind-merge drops the earlier of two
// classes that set the same property, so a caller's `px-6` beats a component's own `px-4`.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
