const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package exports to fix @tanstack/query-core .js import resolution
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['require', 'react-native', 'browser', 'import'];

// Add explicit modern extensions for TanStack Query
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;
