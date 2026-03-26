const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add explicit modern extensions for TanStack Query
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;
