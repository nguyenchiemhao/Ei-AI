import { describe, expect, it } from 'vitest';
import { createWorkspaceSchema, updateWorkspaceSchema } from './workspace.dto';

describe('createWorkspaceSchema', () => {
  it('trims the name and keeps the optional fields optional', () => {
    const parsed = createWorkspaceSchema.parse({ name: '  Hợp đồng  ' });

    expect(parsed).toEqual({ name: 'Hợp đồng' });
  });

  it('refuses a name that is blank once trimmed', () => {
    expect(createWorkspaceSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('refuses a name longer than the column expects to be read', () => {
    expect(createWorkspaceSchema.safeParse({ name: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('updateWorkspaceSchema', () => {
  it('accepts a single field', () => {
    expect(updateWorkspaceSchema.safeParse({ status: 'archived' }).success).toBe(true);
    expect(updateWorkspaceSchema.safeParse({ name: 'Đổi tên' }).success).toBe(true);
  });

  // A PATCH that changes nothing is a mistake worth naming rather than a request to serve.
  it('refuses a patch with no fields at all', () => {
    expect(updateWorkspaceSchema.safeParse({}).success).toBe(false);
  });

  it('refuses a status the CHECK constraint would reject anyway', () => {
    expect(updateWorkspaceSchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });
});
