import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    { ignores: ['dist', 'node_modules'] },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: { ecmaFeatures: { jsx: true } }
        },
        plugins: { '@stylistic': stylistic, 'react-hooks': reactHooks },
        rules: {
            '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],
            '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/no-trailing-spaces': 'error',
            eqeqeq: 'error',
            'no-console': ['error', { allow: ['warn', 'error'] }],
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn'
        }
    },
    {
        files: ['**/*.test.ts'],
        rules: { 'no-console': 'off' }
    }
];
