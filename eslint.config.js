import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Flat config (ESLint 10 + typescript-eslint 8). Syntactic rules only — no
// type-aware linting, so no project service wiring is needed to keep lint fast.
export default tseslint.config(
  { ignores: ['dist/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
);
