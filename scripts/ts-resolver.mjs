/**
 * Lets the Node test runner import the app's TypeScript sources using the
 * same extensionless specifiers the bundler uses ('./conditions').
 * Node strips the types itself; this only fills in the extension.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try {
          return await nextResolve(candidate, context);
        } catch {
          // fall through to the next candidate
        }
      }
    }
    throw error;
  }
}
