// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'landing/out/*', 'landing/.next/*', 'landing/node_modules/*', 'supabase/functions/**'],
  },
]);
