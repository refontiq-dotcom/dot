import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });
const tsFile = {
  files: ['**/*.ts', '**/*.tsx'],
  rules: {
    '@typescript-eslint/triple-slash-reference': 'off',
  },
};
export default [
  {
    ignores: ['.next/**'],
  },
  {
    files: ['next-env.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  tsFile,
];
