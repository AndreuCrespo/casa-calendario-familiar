// Unit tests for pure modules (no browser, no Firebase). Kept apart from
// vite.config.ts so the PWA plugin isn't loaded. Firestore rules tests have
// their own config (vitest.rules.config.ts) because they need the emulator.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
