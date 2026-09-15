import tseslint from 'typescript-eslint';

// The TypeScript parser alone, for a config that must read TS syntax without inheriting the
// shared rule set. Stage 4's architecture rules are that case: a stage that also reported
// stage 1's findings would go red for reasons outside the invariant it defends.
export default tseslint.parser;
