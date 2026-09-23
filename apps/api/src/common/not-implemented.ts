import { PLANNED_FEATURES, type FeatureKey } from '@ei-ai/shared-types';
import { AppException } from './app-exception';

// Detail §7.1: an unbuilt module is a 501 with a body, not a 404. The body names the feature and
// the phase it arrives in, read from the same table `GET /me` returns, so a screen and its endpoint
// cannot disagree about when the thing is coming.
//
// The guards run before the handler, so a caller whose role may not reach the route receives 403
// and never learns the feature exists. That ordering is the point: a stub is still a route, and
// authorisation is not something the web app is trusted to do.
export function notImplemented(feature: FeatureKey): never {
  const planned = PLANNED_FEATURES[feature];
  throw new AppException('NOT_IMPLEMENTED', `${feature} arrives in phase ${planned.plannedPhase}`, {
    feature,
    plannedPhase: planned.plannedPhase,
  });
}
