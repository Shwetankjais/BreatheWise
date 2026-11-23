import { defineConfig } from '@playwright/test';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
export default defineConfig({
  testDir: './tests',
  outputDir: path.join(root, 'work/browser-results'),
  workers: 1,
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'off', screenshot: 'off', video: 'off' },
  webServer: {
    command: 'uv run --locked python scripts/browser_stack.py',
    cwd: root,
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 30000,
    env: { UV_CACHE_DIR: path.join(root,'work/uv-cache') },
  },
  projects: [
    {name: 'desktop', use: {viewport:{width:1440,height:1000}}},
    {name: 'mobile-reduced-motion', use: {viewport:{width:390,height:844}, isMobile:true, reducedMotion:'reduce'}},
  ],
});
