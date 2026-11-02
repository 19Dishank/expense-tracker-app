const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 1. Allow Metro to resolve and bundle .wasm files as assets (required by expo-sqlite on web)
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// 2. Enable package exports so conditional web exports are properly resolved
config.resolver.unstable_enablePackageExports = true;

// 3. Set Cross-Origin headers on dev server for SharedArrayBuffer / wa-sqlite support
config.server = config.server || {};
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return middleware(req, res, next);
  };
};

module.exports = config;

