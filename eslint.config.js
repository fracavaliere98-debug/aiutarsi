// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'landing/out/*', 'landing/.next/*', 'landing/node_modules/*', 'supabase/functions/**'],
  },
  {
    // Migrazione Expo SDK 56 (21/09/2026): eslint-config-expo ha alzato
    // eslint-plugin-react-hooks da ^5.1.0 a ^7.0.0, che abilita di default
    // un nuovo set di regole pensate per la React Compiler readiness
    // (refs, set-state-in-effect, preserve-manual-memoization, purity,
    // immutability, static-components). Il progetto NON usa React Compiler
    // (nessun experiments.reactCompiler in app.json) e diverse di queste
    // regole danno falsi positivi su pattern corretti e già in uso, in
    // particolare `sharedValue.value = ...` di react-native-reanimated,
    // che la regola `immutability` marca come errore pur essendo l'API
    // documentata di Reanimated. Disattivate qui finché non si valuta
    // esplicitamente l'adozione di React Compiler; le regole classiche
    // (rules-of-hooks, exhaustive-deps) restano attive e non sono toccate.
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  {
    // Script Node CommonJS (non passano da Metro): servono i globals Node
    // classici (__dirname, __filename, module, ecc.) e l'accesso dinamico
    // a process.env è legittimo qui (non è codice bundlato lato client,
    // quindi la regola expo/no-dynamic-env-var pensata per l'inlining
    // statico di Metro non si applica).
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'expo/no-dynamic-env-var': 'off',
    },
  },
]);
