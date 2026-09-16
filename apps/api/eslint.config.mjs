import base from '@ei-ai/eslint-config';

export default [
  ...base,
  {
    files: ['src/**/*.ts'],
    rules: {
      // `consistent-type-imports` and `emitDecoratorMetadata` cannot both hold. A class that
      // reaches a constructor only as a parameter type looks type-only to ESLint, but Nest
      // reads it back through `design:paramtypes` at runtime: rewriting the two imports in
      // auth.service.ts as `import type` made the app fail to boot, with the dependencies of
      // AuthService resolving to `[Function: Function]`. The rule stays on for apps/web and
      // packages/*, which have no decorators.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
