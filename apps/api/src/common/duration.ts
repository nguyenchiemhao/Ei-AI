const DURATION = /^(\d+)([smhd])$/;
const SECONDS_IN = { s: 1, m: 60, h: 3600, d: 86400 } as const;

// Token lifetimes are written as `15m` and `8h` in the environment; libraries want seconds, and
// @nestjs/jwt types its own lifetime as a template-literal union a plain string cannot satisfy.
// The shape is validated by the config schema, so a match is guaranteed by the time this runs.
export function toSeconds(duration: string): number {
  const [, amount, unit] = DURATION.exec(duration) ?? [];
  return Number(amount) * SECONDS_IN[unit as keyof typeof SECONDS_IN];
}
