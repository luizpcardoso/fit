const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const contractsRoot = path.resolve(__dirname, '../../packages/contracts/src') + path.sep;
const defaultResolve = config.resolver.resolveRequest;

// Shared contracts use Node-compatible .js imports; the package is consumed as
// TypeScript source by Metro, while the API runs the same source through tsx.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = context.originModulePath.startsWith(contractsRoot) && moduleName.startsWith('.') && moduleName.endsWith('.js')
    ? moduleName.slice(0, -3) + '.ts'
    : moduleName;
  return defaultResolve
    ? defaultResolve(context, target, platform)
    : context.resolveRequest(context, target, platform);
};

module.exports = config;
