/**
 * Resolves the extensionless relative imports the convex/ modules use.
 *
 * Convex's own bundler resolves `./conditionTypes` to the .ts file. Plain
 * Node ESM does not, so the tests register this hook and then run the
 * real modules unmodified, rather than keeping a test-only copy of them.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    const base = new URL(specifier, context.parentURL);
    for (const candidate of [`${base.href}.ts`, `${base.href}/index.ts`]) {
      if (existsSync(fileURLToPath(candidate))) {
        return next(pathToFileURL(fileURLToPath(candidate)).href, context);
      }
    }
  }
  return next(specifier, context);
}
