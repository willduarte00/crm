import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      APP_ENV: 'local',
      PORT: '3000',
      DATABASE_URL: 'postgresql://test_user:test_pass@localhost:5432/test_db',
      JWT_SECRET: 'super-secret-jwt-key-for-tests-123456789',
    },
    coverage: {
      provider: 'v8',
    },
  },
});
