// ESLint 9 flat config
const nextConfig = require('eslint-config-next')
const prettierConfig = require('eslint-config-prettier')

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  // Global ignores (replaces .eslintignore)
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'prisma/migrations/**',
      'worker/**',
      'scripts/**',
      'public/**',
    ],
  },
  // Next.js flat config (includes React + TypeScript-ESLint rules)
  ...nextConfig,
  // Prettier: disable formatting rules that conflict with prettier
  { rules: prettierConfig.rules },
  // Project-level overrides
  {
    rules: {
      // React Compiler hints — informational only, not blocking
      // watch() from react-hook-form can't be memoized but is safe.
      'react-hooks/incompatible-library': 'off',
      // Async data-fetch in useEffect is the standard pattern here.
      // React Compiler's stricter rule would require SWR/React Query.
      'react-hooks/set-state-in-effect': 'off',
      // window.location.href navigation is intentional side-effect code.
      'react-hooks/immutability': 'off',
    },
  },
]
