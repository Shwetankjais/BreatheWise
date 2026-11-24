import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const statePath = path.resolve(import.meta.dirname, '../../../work/browser-state.json');

// Browser connects to a real running API/SQL database containing only explicitly
// synthetic demo records. Failure interception below is labeled test simulation.
test('API observations and disabled forecast remain explicit', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Reset map bounds' })).toBeVisible();
  await expect(page.getByText('Synthetic Delhi example (DEMO)', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('MODEL_UNAVAILABLE', { exact: false }).first()).toBeVisible();
  await expect.poll(async () => { for (const item of await page.getByText(/25\.0/).all()) if (await item.isVisible()) return true; return false; }).toBe(true);
  await page.screenshot({ path: path.resolve(import.meta.dirname, `../../../work/browser-review-${testInfo.project.name}.png`), fullPage: true, animations: 'disabled' });
  await expect(page.getByRole('tab', { name: 'Activity Planner' })).toBeVisible();
  await page.getByRole('tab', { name: 'Activity Planner' }).click();
  await expect(page.getByText(/TRAJECTORY_UNAVAILABLE|trajectory|Trajectory/).first()).toBeVisible();
});

test('503 remains a failure and empty station searches remain empty', async ({ page }) => {
  await page.route('**/api/v1/cities', route => route.fulfill({ status: 503, json: { meta: { request_id: 'test-failure', generated_at: new Date().toISOString(), data_mode: 'live', source: 'synthetic failure test', contract_version: '1.1.0', quality_flags: [] }, error: { code: 'TEST_PROVIDER_OUTAGE', message: 'Test outage', retryable: true, requirements_missing: [], fields: [] } } }));
  await page.goto('/');
  await expect(page.getByText('TEST_PROVIDER_OUTAGE', { exact: false }).first()).toBeVisible();
  await expect(page.getByLabel('Demo mode announcement')).toHaveCount(0);
  await page.unroute('**/api/v1/cities');
  await page.route('**/api/v1/stations?**', route => route.fulfill({ status: 200, json: { meta: { request_id: 'test-empty', generated_at: new Date().toISOString(), data_mode: 'demo', source: 'synthetic empty-filter test', contract_version: '1.1.0', quality_flags: [] }, data: [] } }));
  await page.reload();
  await expect(page.getByText(/no.*stations|no.*monitors/i).first()).toBeVisible();
  await expect(page.getByText('Synthetic Delhi example (DEMO)', { exact: false })).toHaveCount(0);
});

test('authenticated place persists across reload and isolates owners', async ({ page, request }, testInfo) => {
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const label = `Browser persisted fixture ${testInfo.project.name}`;
  await page.goto('/');
  await page.getByRole('tab', { name: 'Saved Places', exact: true }).click();
  await page.getByPlaceholder('Paste provisioned bearer session token...').fill(state.token);
  await page.getByRole('button', { name: /Authenticate|Sign In/i }).click();
  await expect(page.getByRole('button', { name: /Add Pinned Location/i })).toBeEnabled();
  await page.getByRole('button', { name: /Add Pinned Location/i }).click();
  await page.getByPlaceholder('e.g. My Residence, North Campus').fill(label);
  await page.getByRole('button', { name: /Save Location/i }).click();
  await expect(page.getByText(label, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Saved Places', exact: true }).click();
  await expect(page.getByText(label, { exact: true })).toBeVisible();
  const others = await request.get('http://127.0.0.1:8000/api/v1/saved-places', { headers: { Authorization: `Bearer ${state.other_token}` } });
  expect(others.status()).toBe(200);
  expect((await others.json()).data).toEqual([]);
});


test('explicit demo opt-in stays labeled and separate', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo Preview', exact: true }).click();
  await expect(page.getByLabel('Demo mode announcement')).toBeVisible();
  await expect(page.getByText(/synthetic|demo/i).first()).toBeVisible();
  await page.getByRole('button', { name: 'Exit Demo Mode', exact: true }).click();
  await expect(page.getByLabel('Demo mode announcement')).toHaveCount(0);
});
