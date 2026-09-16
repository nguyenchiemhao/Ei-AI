import { z } from 'zod';

// The password is only checked for presence. Applying the policy here would tell an attacker
// what the policy is, and would lock out accounts whose password predates a policy change.
export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginSchema>;

export interface AuthenticatedUser {
  accessToken: string;
  userId: string;
  email: string;
  displayName: string;
  systemRole: string;
}
