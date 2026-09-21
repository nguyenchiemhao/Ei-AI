import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { searchSchema } from './search.dto';

const parse = (body: unknown) => searchSchema.safeParse(body);

describe('searchSchema', () => {
  it('accepts a question on its own', () => {
    expect(parse({ question: 'Thời hạn thanh toán là bao lâu?' }).success).toBe(true);
  });

  it('trims the surrounding whitespace off the question', () => {
    const parsed = searchSchema.parse({ question: '  hợp đồng  ' });
    expect(parsed.question).toBe('hợp đồng');
  });

  it('refuses a question that is only whitespace', () => {
    expect(parse({ question: '   ' }).success).toBe(false);
  });

  it('refuses a missing question rather than searching for nothing', () => {
    expect(parse({}).success).toBe(false);
  });

  it('refuses a question longer than the limit', () => {
    expect(parse({ question: 'x'.repeat(2001) }).success).toBe(false);
    expect(parse({ question: 'x'.repeat(2000) }).success).toBe(true);
  });

  it('keeps Vietnamese intact rather than normalising it away', () => {
    const question = 'Điều khoản bảo mật của hợp đồng gia công cơ khí';
    expect(searchSchema.parse({ question }).question).toBe(question);
  });

  it('leaves workspaceIds absent when none is given, which means every membership', () => {
    expect(searchSchema.parse({ question: 'x' }).workspaceIds).toBeUndefined();
  });

  it('accepts a list of workspace ids', () => {
    const workspaceIds = [randomUUID(), randomUUID()];
    expect(searchSchema.parse({ question: 'x', workspaceIds }).workspaceIds).toEqual(workspaceIds);
  });

  it('refuses anything that is not a uuid, so the array cannot carry SQL', () => {
    expect(parse({ question: 'x', workspaceIds: ["' OR 1=1 --"] }).success).toBe(false);
  });

  it('refuses an empty list, which would read as "no workspaces" rather than "all"', () => {
    expect(parse({ question: 'x', workspaceIds: [] }).success).toBe(false);
  });

  it('refuses a list longer than the limit', () => {
    const many = Array.from({ length: 51 }, () => randomUUID());
    expect(parse({ question: 'x', workspaceIds: many }).success).toBe(false);
  });
});
