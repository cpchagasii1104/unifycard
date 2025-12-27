// tsconfig-paths-bootstrap.js
// Bootstrap para resolver path aliases no ts-node
const tsConfigPaths = require('tsconfig-paths');
const tsConfig = require('./tsconfig.json');

const baseUrl = tsConfig.compilerOptions.baseUrl || './src';
const paths = tsConfig.compilerOptions.paths || {};

tsConfigPaths.register({
  baseUrl,
  paths: Object.keys(paths).reduce((acc, key) => {
    acc[key] = paths[key].map(p => p.replace(/^src\//, ''));
    return acc;
  }, {})
});

