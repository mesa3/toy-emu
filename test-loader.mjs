import path from 'node:path';
import { pathToFileURL } from 'node:url';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === 'three') {
    return {
      url: pathToFileURL(path.resolve(__dirname, 'mocks/three.js')).href,
      shortCircuit: true
    };
  }
  if (specifier.includes('OBJLoader')) {
    return {
      url: pathToFileURL(path.resolve(__dirname, 'mocks/OBJLoader.js')).href,
      shortCircuit: true
    };
  }
  if (specifier.includes('BufferGeometryUtils')) {
    return {
      url: pathToFileURL(path.resolve(__dirname, 'mocks/BufferGeometryUtils.js')).href,
      shortCircuit: true
    };
  }
  return defaultResolve(specifier, context, defaultResolve);
}
