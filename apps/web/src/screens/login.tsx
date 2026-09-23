import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ApiError } from '../lib/api-client';
import { signIn } from '../lib/session';
import { useAuth } from '../state/auth.store';

// The lockout has to say what happened. FR-58 puts the notice on this screen, and a person locked
// out after ten attempts who is told only "incorrect" will keep trying and stay locked.
const MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'Email or password is incorrect.',
  AUTH_ACCOUNT_LOCKED:
    'This account is locked after too many failed attempts. It unlocks automatically after the ' +
    'lockout period, or an administrator can unlock it now.',
  RATE_LIMITED: 'Too many attempts from this account. Wait a few minutes and try again.',
  VALIDATION_FAILED: 'Enter an email address and a password.',
};

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? error.detail;
  }
  return 'The server could not be reached.';
}

export function LoginScreen() {
  const status = useAuth((state) => state.status);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = useMutation({
    mutationFn: () => signIn(email, password),
    onSuccess: () => void navigate('/search', { replace: true }),
  });

  if (status === 'authenticated') return <Navigate to="/search" replace />;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Sign in to Ei-AI</h1>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {submit.isError && (
          <p role="alert" className="text-sm text-destructive">
            {messageOf(submit.error)}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={submit.isPending}>
          {submit.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
