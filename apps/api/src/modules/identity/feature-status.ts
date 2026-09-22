import {
  FEATURE_ENV_FLAG,
  type FeatureKey,
  type FeatureStatusMap,
  PLANNED_FEATURES,
} from '@ei-ai/shared-types';
import type { Env } from '../../config/env.schema';

const KEYS = Object.keys(PLANNED_FEATURES) as FeatureKey[];

// The §7.1 map, with the four variables that name a feature overriding its status. The phase is
// never overridden: when a feature arrives is a fact about the plan, not a setting.
export function featureStatusOf(config: Env): FeatureStatusMap {
  const overrides: Partial<Record<FeatureKey, string>> = FEATURE_ENV_FLAG;
  return Object.fromEntries(
    KEYS.map((key) => {
      const flag = overrides[key] as keyof Env | undefined;
      const planned = PLANNED_FEATURES[key];
      return [key, flag === undefined ? planned : { ...planned, status: config[flag] }];
    }),
  ) as FeatureStatusMap;
}
