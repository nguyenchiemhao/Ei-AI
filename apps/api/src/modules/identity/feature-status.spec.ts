import { PLANNED_FEATURES } from '@ei-ai/shared-types';
import { describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.schema';
import { featureStatusOf } from './feature-status';

// All four are named on every call: three of them default to `coming_soon` in the schema, so a
// fixture that omitted one would be testing the default rather than the value it meant to set.
const config = (overrides: Partial<Env> = {}): Env =>
  ({
    FEATURE_AGENT_LOOP: 'coming_soon',
    FEATURE_VERIFIED_ANSWERS: 'coming_soon',
    FEATURE_APPROVALS: 'coming_soon',
    FEATURE_CONNECTORS: 'coming_soon',
    ...overrides,
  }) as Env;

describe('the FEATURE_STATUS map', () => {
  it('carries every unbuilt module of Detail §7.1', () => {
    expect(Object.keys(featureStatusOf(config())).sort()).toEqual(
      Object.keys(PLANNED_FEATURES).sort(),
    );
  });

  it('gives each one the phase that finishes it', () => {
    expect(featureStatusOf(config())['agent-loop']).toEqual({
      module: 'agent',
      plannedPhase: '2B',
      status: 'coming_soon',
    });
  });

  it('lets the environment override the status of a feature it names', () => {
    const map = featureStatusOf(config({ FEATURE_AGENT_LOOP: 'disabled' }));

    expect(map['agent-loop'].status).toBe('disabled');
  });

  // The phase is a fact about the plan. An operator who disables the agent loop has not moved it
  // to a different milestone, and a badge that said so would be wrong.
  it('never lets the environment move a phase', () => {
    const map = featureStatusOf(config({ FEATURE_AGENT_LOOP: 'available' }));

    expect(map['agent-loop'].plannedPhase).toBe('2B');
  });

  // The control: four features have a variable and four do not, and a merge that applied the
  // wrong key to everything would still pass the tests above.
  it('leaves a feature with no variable of its own at its §7.1 status', () => {
    const map = featureStatusOf(
      config({
        FEATURE_AGENT_LOOP: 'available',
        FEATURE_VERIFIED_ANSWERS: 'available',
        FEATURE_APPROVALS: 'available',
        FEATURE_CONNECTORS: 'available',
      }),
    );

    expect(map.evaluation.status).toBe('coming_soon');
    expect(map['model-provider'].status).toBe('coming_soon');
    expect(map.administration.status).toBe('coming_soon');
    expect(map['tool-administration'].status).toBe('coming_soon');
  });

  it('maps each variable to the feature it names and no other', () => {
    const map = featureStatusOf(config({ FEATURE_APPROVALS: 'disabled' }));

    expect(map.approvals.status).toBe('disabled');
    expect(map['agent-loop'].status).toBe('coming_soon');
    expect(map.connectors.status).toBe('coming_soon');
  });
});
