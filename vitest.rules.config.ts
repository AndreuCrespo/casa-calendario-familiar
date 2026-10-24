// Firestore security rules tests (tests/rules). They need the Firestore
// emulator, so they have their own config apart from the unit tests:
//
//   firebase emulators:exec --only firestore --project demo-casa \
//     "npx vitest run --config vitest.rules.config.ts"
//
// The demo-* project id keeps the emulator away from any real project.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // Every file talks to the same emulator database and clears it before each
    // test, so files must not run at the same time.
    fileParallelism: false,
    // Denied writes are expected here, and the Firestore SDK logs each one to
    // stderr: only show logs for tests that fail.
    silent: 'passed-only',
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
