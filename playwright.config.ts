import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: 'http://127.0.0.1:4173'
  },
  webServer: {
    command: 'pnpm exec http-server src -a 127.0.0.1 -p 4173 -c-1 --silent',
    url: 'http://127.0.0.1:4173'
  }
});
