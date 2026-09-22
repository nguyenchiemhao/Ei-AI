import { TOOL_NAMES } from '@ei-ai/shared-types';
import { describe, expect, it } from 'vitest';
import { type AvailableTool, operatingModeOf } from './operating-mode';

const internal = (name: string): AvailableTool => ({ name, mcpServerId: null });
const fromServer = (name: string): AvailableTool => ({ name, mcpServerId: 's-1' });

const search = internal(TOOL_NAMES.SEARCH_DOCUMENTS);
const web = internal(TOOL_NAMES.WEB_SEARCH);

describe('the operating mode, computed from the registry', () => {
  it('is document-only on a clean install', () => {
    expect(operatingModeOf({ available: [search], mcpServerCount: 0 })).toEqual({
      operatingMode: 'document-only',
      toolGroups: { documents: 'on', web: 'off', erp: 'not_configured' },
    });
  });

  it('is document+web once web search is available', () => {
    expect(operatingModeOf({ available: [search, web], mcpServerCount: 0 })).toMatchObject({
      operatingMode: 'document+web',
      toolGroups: { web: 'on' },
    });
  });

  it('is document+web+erp once a server contributes a tool', () => {
    const state = { available: [search, web, fromServer('erp.read_invoice')], mcpServerCount: 1 };
    expect(operatingModeOf(state)).toMatchObject({
      operatingMode: 'document+web+erp',
      toolGroups: { erp: 'on' },
    });
  });

  // FR-78, and the half of the Done when that is about not raising a false alarm: no server is a
  // supported configuration, so the indicator says `not_configured` and never `off`.
  it('calls the ERP group not_configured when no server is registered', () => {
    expect(operatingModeOf({ available: [search], mcpServerCount: 0 }).toolGroups.erp).toBe(
      'not_configured',
    );
  });

  // A registered server whose tools are all disabled is a decision, not an absence, so it reads
  // `off`. Without this case the two states would be indistinguishable to the dashboard.
  it('calls it off when a server is registered but contributes nothing', () => {
    expect(operatingModeOf({ available: [search], mcpServerCount: 1 }).toolGroups.erp).toBe('off');
  });

  // The ADR-10 deviation made visible. The design says `search_documents` cannot be switched off;
  // TOOL_SEARCH_DOCUMENTS_ENABLED can switch it off, and this is what the installation then
  // reports — still `document-only`, because that names the group, with the group itself off.
  it('reports documents off, and still document-only, when the search tool is withheld', () => {
    expect(operatingModeOf({ available: [], mcpServerCount: 0 })).toEqual({
      operatingMode: 'document-only',
      toolGroups: { documents: 'off', web: 'off', erp: 'not_configured' },
    });
  });

  // There is no `document+erp` in design §3's table, so an ERP without web still names the full
  // mode. Asserted rather than left implicit, because it is the one row a reader expects to exist.
  it('names the full mode for an ERP without web search', () => {
    const state = { available: [search, fromServer('erp.read_invoice')], mcpServerCount: 1 };
    expect(operatingModeOf(state)).toMatchObject({
      operatingMode: 'document+web+erp',
      toolGroups: { web: 'off', erp: 'on' },
    });
  });
});
