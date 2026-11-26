import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.browser },
  },
  {
    files: ['sw.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: globals.serviceworker },
  },
  {
    files: ['test/**/*.js', 'scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
  },
  {
    files: ['apps-script/**/*.gs', 'apps-script/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        SpreadsheetApp: 'readonly',
        PropertiesService: 'readonly',
        LockService: 'readonly',
        CacheService: 'readonly',
        ContentService: 'readonly',
        Utilities: 'readonly',
        Logger: 'readonly',
      },
    },
    rules: {
      // Le funzioni globali di Apps Script (doGet, doPost, setup...) sono chiamate dall'esterno
      'no-unused-vars': ['error', { varsIgnorePattern: '^(doGet|doPost|setup)$' }],
    },
  },
];
