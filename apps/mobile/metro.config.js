const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Gradle/Robolectric outputs contain thousands of generated resource directories.
// They are native build inputs, not JavaScript dependencies; watching them can exhaust inotify.
const existingBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList) ? existingBlockList : existingBlockList ? [existingBlockList] : []),
  /[\\/]android[\\/](?:app[\\/])?(?:build|\.cxx|\.gradle)(?:[\\/]|$)/,
];
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
