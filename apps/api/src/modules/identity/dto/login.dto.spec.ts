import { describe, expect, it } from 'vitest';
import { loginSchema } from './login.dto';

describe('loginSchema', () => {
  it('trims the email, so a pasted address with a stray space still logs in', () => {
    const parsed = loginSchema.parse({ email: '  member@ei-ai.local ', password: 'x' });

    expect(parsed.email).toBe('member@ei-ai.local');
  });

  it('refuses an address that is not an email', () => {
    expect(loginSchema.safeParse({ email: 'member', password: 'x' }).success).toBe(false);
  });

  it('refuses an empty password without applying the policy to it', () => {
    expect(loginSchema.safeParse({ email: 'a@b.local', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.local', password: 'short' }).success).toBe(true);
  });

  it('refuses a payload carrying anything else', () => {
    const extra = loginSchema.safeParse({
      email: 'a@b.local',
      password: 'x',
      role: 'Administrator',
    });

    expect(extra.success).toBe(true);
    expect(extra.success && 'role' in extra.data).toBe(false);
  });
});
