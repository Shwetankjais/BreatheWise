// Opt-in final localhost walk. A fresh exact-path freeze/fingerprint is mandatory.
// Actual API responses only: no route interception, fixture substitution or fake alerts.
import { chromium, expect } from '../node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const api = process.env.PROTOTYPE_API_URL || 'http://127.0.0.1:8000';
const web = process.env.PROTOTYPE_WEB_URL || 'http://127.0.0.1:5173';
const folder = path.join(root, 'work/prototype');
const snapshotFile = path.join(folder, 'final-fingerprint.json');
if (!fs.existsSync(snapshotFile)) throw new Error('Fresh acknowledged final-path fingerprint required');
const stored = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
const snapshot = stored.paths || stored.fingerprints || stored.hashes || stored;
const tracked = Object.entries(snapshot).filter(([, value]) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const changed = () => tracked.filter(([file, value]) => !fs.existsSync(path.join(root, file)) || hash(file) !== value).map(([file]) => file);
if (!tracked.length || changed().length) throw new Error('Final fingerprint empty or already changed');
const token = fs.readFileSync(path.join(folder, 'session.token'), 'utf8').trim();
const sensitive = [token];
const redact = value => sensitive.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), String(value));
const evidence = { verified_at_utc: new Date().toISOString(), scope: 'Actual localhost API/web and configured real assets; explicitly identified authenticated owned writes', profiles: [], fingerprint_paths: tracked.length, all_capabilities_available: false };

function ownershipSession() {
  const file = path.join(folder, 'ownership-session.token');
  if (!fs.existsSync(file)) {
    const task = spawnSync('uv', ['run', '--locked', 'python', 'scripts/provision_session.py', '--output', file], {
      cwd: root, env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || `sqlite:///${path.join(root, 'work/delhi-live.db')}`, DATA_MODE: 'live', UV_CACHE_DIR: path.join(root, 'work/uv-cache') }, encoding: 'utf8'
    });
    if (task.status !== 0) throw new Error('Private second identity provisioning failed; no token is logged');
  }
  const other = fs.readFileSync(file, 'utf8').trim();
  sensitive.push(other);
  return other;
}
function alertWorker() {
  const task = spawnSync('uv', ['run', '--locked', 'python', 'scripts/run_worker.py', '--provider', 'none'], {
    cwd: root, env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || `sqlite:///${path.join(root, 'work/delhi-live.db')}`, DATA_MODE: 'live', UV_CACHE_DIR: path.join(root, 'work/uv-cache') }, encoding: 'utf8', timeout: 30000
  });
  if (task.status !== 0) throw new Error('Actual alert-only worker did not complete; no fixture delivery substituted');
  const events = task.stdout.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  const outcome = events.findLast(event => event.event === 'cycle_finished');
  if (!outcome) throw new Error('Actual alert-only worker did not report a cycle outcome');
  return { status: outcome.status, alerts_created: outcome.alerts_created };
}
const otherToken = ownershipSession();
const browser = await chromium.launch();
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: name === 'mobile', reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const captures = [];
    const profile = { viewport: name, checks: [], deferred_capabilities: [] };
    const check = (name, details = {}) => profile.checks.push({ name, status: 'passed', ...details });
    const pending = (name, reason) => profile.checks.push({ name, status: 'pending', reason });
    const step = async (name, fn) => { try { await fn(); } catch (error) { profile.checks.push({ name, status: 'failed', error: redact(error.message).slice(0, 2200) }); } };
    page.on('response', async response => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith('/api/v1/')) return;
      let json = null;
      try { json = await response.json(); } catch {}
      captures.push({ pathname: url.pathname, path: url.pathname + url.search, status: response.status(), method: response.request().method(), json });
    });
    const captured = async (part, predicate = () => true) => {
      let found;
      await expect.poll(() => { found = captures.findLast(item => item.path.includes(part) && predicate(item)); return Boolean(found); }, { timeout: 30000, message: `Actual response unavailable for ${part}` }).toBe(true);
      return found;
    };
    const live = async (endpoint, options = {}) => {
      const result = await context.request.get(api + '/api/v1' + endpoint, options);
      expect(result.status()).toBe(200);
      return (await result.json()).data;
    };
    const auth = { Authorization: `Bearer ${token}` };
    const otherAuth = { Authorization: `Bearer ${otherToken}` };
    const screenshot = async section => {
      await expect(page.locator('input[type="password"]:visible')).toHaveCount(0);
      expect(await page.locator('body').evaluate(body => body.scrollWidth <= window.innerWidth)).toBe(true);
      return page.screenshot({ path: path.join(folder, `walk-${section}-${name}.png`), fullPage: true, animations: 'disabled', mask: [page.locator('input[type="password"]')] });
    };
    const tab = name => page.getByRole('tab', { name, exact: true }).click();

    await step('actual observations and station units', async () => {
      await page.goto(web);
      const catalogue = await captured('/station-catalogue', x => x.status === 200);
      await expect(page.locator('.leaflet-marker-icon')).toHaveCount(catalogue.json.data.stations.length);
      const rankings = await live('/observed-rankings?city_id=delhi&pollutant=pm25&include_stale=true');
      for (const row of rankings.rows) await expect(page.locator('.leaflet-marker-icon').getByRole('button', { name: `${row.station.name}: ${row.measurement.value} µg/m³`, exact: true })).toBeVisible();
      await expect(page.getByLabel('Demo mode announcement')).toHaveCount(0);
      check('observation marker values match actual API', { stations: catalogue.json.data.stations.length, observations: rankings.rows.map(row => ({ station_id: row.station.id, value: row.measurement.value, measured_at: row.measurement.measured_at, unit: row.measurement.unit, stale: row.measurement.stale })) });
      await screenshot('observations');
    });

    await step('station selection pollutant details and weather', async () => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({latitude:28.646835,longitude:77.316032});
      const marker=page.locator('.leaflet-marker-icon').first();
      await marker.click();
      const pollutants=await captured('/pollutants', x=>x.status===200);
      const card=page.getByTestId('station-pollutants-card');
      for (const [key,row] of Object.entries(pollutants.json.data)) {
        await expect(card).toBeVisible();
        if (row.available) await expect(card).toContainText(String(row.value));
      }
      await page.getByTitle('Locate nearest station using browser geolocation').click();
      const result=await captured('/environment/context', x=>x.status===200);
      const weather=result.json.data.weather;
      if(weather?.available) await expect(page.getByTestId('meteorological-context')).toContainText(weather.temperature_c.toFixed(1)+' °C');
      else await expect(page.getByTestId('meteorological-context')).toContainText(/unavailable/);
      check('station pollutants and weather context match API', {station:pollutants.pathname, weather_available:weather?.available, weather_timestamp:weather?.source_timestamp});
    });

    await step('recorded-clock archive and matched comparison', async () => {
      await tab('Historical EDA');
      await page.getByRole('button', { name: 'Audited Archive (Recorded Clock)', exact: true }).click();
      const dates = page.getByPlaceholder('YYYY-MM-DDTHH:MM:SS');
      await dates.nth(0).fill('2026-10-01T00:00:00');
      await dates.nth(1).fill('2026-11-01T00:00:00');
      const result = await captured('/archive/explore', x => x.status === 200 && new URL(x.path, api).searchParams.get('end') === '2026-11-01T00:00:00');
      const data = result.json.data;
      expect(data.dataset_mode).toBe('recorded_clock'); expect(data.timezone).toBeNull();
      await expect(page.getByText(`Archive Bucket Sequence (${data.points.length} Periods)`, { exact: true })).toBeVisible();
      await expect(page.getByText(data.distribution.mean.toFixed(1), { exact: true }).first()).toBeVisible();
      await page.getByRole('button', { name: 'Matched Station Comparison (2–4 Sites)', exact: true }).click();
      const comparison = await captured('/archive/compare', x => x.status === 200);
      const paired = comparison.json.data;
      expect(new URL(comparison.path, api).searchParams.get('clock_assumption')).toBe('same_recorded_clock');
      await expect(page.getByText(`Matched Hours: ${paired.matched_hour_count}`, { exact: false })).toBeVisible();
      await expect(page.getByText(`${paired.pair_agreement[0].mean_absolute_difference.toFixed(2)} ${paired.unit}`, { exact: true }).first()).toBeVisible();
      check('archive and comparison values match actual responses', { valid: data.valid_count, expected: data.expected_count, mean: data.distribution.mean, matched_hours: paired.matched_hour_count, unit: paired.unit, alignment_status: paired.alignment_status });
      await screenshot('archive');
    });

    await step('both registry clocks and issue-purged playback', async () => {
      await tab('Model Audit');
      await page.getByRole('button', { name: /Tier 2: Experimental Model/ }).click();
      const registry = await live('/models');
      for (const version of ['delhi-recorded-pm25-hourly-v2', 'delhi-openaq-pm25-hourly-v1']) {
        const model = registry.models.find(row => row.model_version === version);
        expect(model).toBeTruthy();
        await page.locator('#model-version-selector').selectOption(version);
        const evaluation = await captured(model.evaluation_path, x => x.status === 200);
        const data = evaluation.json.data;
        expect(data.evaluation_cohort).toBe('fixed_model_issue_time_purged');
        expect(data.supported_horizons).toEqual(model.supported_horizons);
        const metrics = data.horizons.find(row => row.horizon_h === 1).splits.test.common_baseline_cohort;
        const row = page.getByRole('row').filter({ hasText: '+1h' }).first();
        await expect(row).toContainText(String(metrics.lightgbm.count));
        await expect(row).toContainText(metrics.lightgbm.mae.toFixed(1));
        await page.getByRole('button', { name: '+3h', exact: true }).click();
        const result = await captured(model.predictions_path, x => x.status === 200 && new URL(x.path, api).searchParams.get('horizon_h') === '3' && new URL(x.path, api).searchParams.get('issue_time_purged') === 'true');
        const prediction = result.json.data;
        const point = prediction.points[0];
        expect(prediction.evaluation_cohort).toBe('fixed_model_issue_time_purged');
        await expect(page.getByRole('cell', { name: `${point.lightgbm.toFixed(1)} µg/m³`, exact: true }).first()).toBeVisible();
        check('registry clock-specific evaluation and purged playback', { model_version: version, dataset_mode: data.dataset_mode, timezone: data.timezone, horizon_h: 3, matched_cohort_count_h1: metrics.lightgbm.count, mae_h1: metrics.lightgbm.mae, playback_rows: prediction.total_count, first_forecast: point.lightgbm });
      }
      await screenshot('models');
    });

    await step('learned shadow run and real failure detail', async () => {
      await page.getByRole('button', { name: /Tier 3:/ }).click();
      const [queried] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/forecast-runs' && response.request().method() === 'GET' && response.status() === 200),
        page.getByRole('button', { name: 'Query Runs', exact: true }).click()
      ]);
      const rows = (await queried.json()).data.runs;
      const table = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Scheduled Issue (UTC)', exact: true }) });
      await expect(table.locator('tbody > tr')).toHaveCount(rows.length);
      const showDetail = async run => {
        const index = rows.findIndex(row => row.id === run.id);
        expect(index).toBeGreaterThanOrEqual(0);
        const row = table.locator('tbody > tr').nth(index);
        await expect(row.getByRole('cell').nth(1)).toContainText(run.model_version);
        const [response] = await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/forecast-runs/' + run.id && response.status() === 200),
          row.getByRole('button', { name: 'View Detail', exact: true }).click()
        ]);
        const detail = (await response.json()).data;
        expect(detail.run.id).toBe(run.id);
        await expect(page.getByText(run.id, { exact: true })).toBeVisible();
        return detail;
      };
      const learnedVersion = 'delhi-openaq-pm25-delay3h-v2';
      const success = rows.find(run => run.status === 'succeeded' && run.model_version === learnedVersion);
      let checkedRejection;
      if (success) {
        const detail = await showDetail(success);
        expect(detail.predictions).toHaveLength(24);
        expect(new Set(detail.predictions.map(point => point.target_at)).size).toBe(24);
        expect(detail.run.provenance.forecast_kind).toBe('learned_availability_scenario');
        expect(detail.run.input_sha256).toMatch(/^[a-f0-9]{64}$/);
        for (const point of detail.predictions) expect(new Date(point.target_at).getTime()).toBeGreaterThan(new Date(detail.run.generated_at).getTime());
        for (const point of [detail.predictions[0], detail.predictions[23]]) await expect(page.getByRole('cell', { name: `${point.concentration.toFixed(1)} ${point.unit}`, exact: true }).first()).toBeVisible();
        check('actual learned experimental 24-target run displayed', { run_id: success.id, model_version: success.model_version, operation: detail.run.operation, prediction_count: detail.predictions.length, first: detail.predictions[0].concentration, last: detail.predictions[23].concentration, input_sha256: detail.run.input_sha256 });
      } else {
        // This one declared real-input blocker is a deferred capability, not a
        // fabricated success or a software-test failure. Other missing UI remains pending.
        const rejected = rows.find(run => run.model_version === learnedVersion && run.status === 'rejected');
        expect(rejected, 'A genuine learned-model run or its precise persisted rejection must exist').toBeTruthy();
        const detail = await showDetail(rejected);
        expect(detail.run.error_code).toBe('AVAILABILITY_REQUIRED_INPUT_UNAVAILABLE');
        expect(detail.predictions).toHaveLength(0);
        expect(detail.run.prediction_count).toBe(0);
        expect(detail.run.input_sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(detail.run.provenance.forecast_kind).toBe('learned_availability_scenario');
        await expect(page.getByText(detail.run.error_code, { exact: false }).last()).toBeVisible();
        checkedRejection = rejected.id;
        const blocker = { capability: 'genuine_learned_shadow_forecast', model_version: learnedVersion, run_id: rejected.id, error_code: detail.run.error_code, input_sha256: detail.run.input_sha256, prediction_count: 0, condition: 'Actual eligible inputs must satisfy the independently trained publication-delay/required-lag regime; no freshness widening or synthetic substitution' };
        profile.deferred_capabilities.push(blocker);
        check('learned input unavailability is precisely persisted and displayed', blocker);
      }
      const rejected = rows.find(run => run.status === 'rejected' && run.id !== checkedRejection);
      if (rejected) {
        const detail = await showDetail(rejected);
        expect(detail.predictions).toHaveLength(0);
        await expect(page.getByText(rejected.error_code, { exact: false }).last()).toBeVisible();
        check('actual rejected run remains failed and empty', { run_id: rejected.id, code: rejected.error_code, predictions: 0 });
      }
      await screenshot('runs');
    });

    await step('replay duration bounds and no-window state', async () => {
      await tab('Activity Planner');
      const card = page.getByTestId('replay-planner');
      await expect(card).toBeVisible();
      await card.getByLabel('Replay model').selectOption('delhi-openaq-pm25-hourly-v1');
      await card.getByLabel('Activity duration').selectOption('120');
      await card.getByLabel('Earliest start after issue').fill('2');
      await card.getByLabel('Latest end after issue').fill('20');
      const run = async () => {
        const [response] = await Promise.all([
          page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/activity-plan/replay' && r.request().method() === 'POST'),
          card.getByRole('button', {name:'Compare historical windows',exact:true}).click()
        ]);
        expect(response.status()).toBe(200);
        const body=response.request().postDataJSON();
        expect(body.duration_minutes).toBe(120);expect(body.earliest_start_h).toBe(2);expect(body.latest_end_h).toBe(20);
        return (await response.json()).data;
      };
      const data=await run();expect(data.status).toBe('available');
      expect(data.windows.length).toBeGreaterThan(0);
      await expect(card).toContainText(data.windows[0].concentration_time.toFixed(2));
      await card.getByLabel('Mean concentration ceiling').fill('0');
      const empty=await run();expect(empty.status).toBe('no_suitable_window');
      await expect(card).toContainText(/No Window Meets Your Criteria/i);
      check('one-issue replay duration/bounds and genuine no-window response', {model:data.model_version, issue:data.issue_at, clock:data.clock_basis, first_window:data.windows[0], empty_status:empty.status});
      await screenshot('planning');
    });

    await step('actual route geometry without exposure', async () => {
      await tab('Routes (Exp)');
      const result = await captured('/routes/geometry', item => item.status === 200);
      const data = result.json.data;
      expect(data.exposure_ready).toBe(false);
      for (const route of data.routes) {
        expect(route.exposure).toBeNull(); expect(route.traffic_aware).toBe(false);
        await expect(page.getByText(`(${route.distance_m}m)`, { exact: true })).toBeVisible();
        await expect(page.getByText(`${Math.round(route.estimated_duration_s / 60)} mins`, { exact: true }).first()).toBeVisible();
      }
      await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toHaveCount(data.routes.length);
      check('route values and unavailable exposure match provider result', { alternatives: data.routes.length, distances_m: data.routes.map(route => route.distance_m), estimated_durations_s: data.routes.map(route => route.estimated_duration_s) });
      await screenshot('routes');
    });

    await step('owned places and sensitivity preferences persist', async () => {
      await tab('Saved Places');
      const field = page.getByPlaceholder('Paste provisioned bearer session token...');
      await field.fill(token);
      await page.getByRole('button', { name: 'Authenticate Session', exact: true }).click();
      await expect(field).toHaveCount(0);
      const stations = await live('/stations?city_id=delhi');
      const station = stations.find(row => row.id === 'openaq-235') || stations[0];
      const label = `Prototype verified bookmark ${name}`;
      const places = await live('/saved-places', { headers: auth });
      let place = places.find(row => row.label === label);
      if (!place) {
        await page.getByRole('button', { name: '+ Add Pinned Location', exact: true }).click();
        await page.getByPlaceholder('e.g. My Residence, North Campus').fill(label);
        await page.getByLabel('Associate Geographic Coordinates via Station').selectOption(station.id);
        const [creation] = await Promise.all([
          page.waitForResponse(response => response.url().endsWith('/api/v1/saved-places') && response.request().method() === 'POST' && response.status() === 201),
          page.getByRole('button', { name: 'Save Location', exact: true }).click()
        ]);
        place = (await creation.json()).data;
      }
      expect(place.latitude).toBe(station.latitude); expect(place.longitude).toBe(station.longitude);
      await expect(page.getByText(label, { exact: true })).toBeVisible();
      const original = await live('/preferences', { headers: auth });
      let otherStatus;
      try {
        const cohort = page.locator('select').filter({ has: page.locator('option[value="sensitive"]') }).first();
        await cohort.selectOption('sensitive');
        const [saved] = await Promise.all([
          page.waitForResponse(response => response.url().endsWith('/api/v1/preferences') && response.request().method() === 'PATCH' && response.status() === 200),
          page.getByRole('button', { name: 'Save Profile Preferences', exact: true }).click()
        ]);
        expect((await saved.json()).data.sensitivity).toBe('sensitive');
        await page.reload(); await tab('Saved Places');
        await expect(page.getByText(label, { exact: true })).toBeVisible();
        await expect(page.locator('select').filter({ has: page.locator('option[value="sensitive"]') }).first()).toHaveValue('sensitive');
        const other = await context.request.patch(api + '/api/v1/saved-places/' + place.id, { headers: otherAuth, data: { label: place.label, latitude: place.latitude, longitude: place.longitude } });
        otherStatus = other.status();
        expect(otherStatus).toBe(404);
        expect((await live('/saved-places', { headers: otherAuth })).some(row => row.id === place.id)).toBe(false);
      } finally {
        expect((await context.request.patch(api + '/api/v1/preferences', { headers: auth, data: original })).status()).toBe(200);
      }
      check('saved place survives refresh and isolates owners', { place_id: place.id, label, latitude: place.latitude, longitude: place.longitude, cross_owner_status: otherStatus, preference_saved: 'sensitive', preference_restored: original.sensitivity });
      await screenshot('account');
    });

    await step('zero threshold persists and notification state is actual', async () => {
      await tab('Saved Places');
      let ruleId;
      try {
        await page.getByRole('button', { name: '+ Create Alert Rule', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Monitoring Station').selectOption('openaq-235');
        await dialog.locator('input[type="number"]').fill('0');
        const [creation] = await Promise.all([
          page.waitForResponse(response => response.url().endsWith('/api/v1/alert-rules') && response.request().method() === 'POST' && response.status() === 201),
          dialog.getByRole('button', { name: 'Save Alert Rule', exact: true }).click()
        ]);
        const data = (await creation.json()).data;
        ruleId = data.id;
        expect(data.threshold).toBe(0); expect(data.averaging_period_minutes).toBe(60);
        await expect(page.getByText('PM25 > 0 µg/m³', { exact: true }).last()).toBeVisible();
        await page.reload(); await tab('Saved Places');
        expect((await live('/alert-rules', { headers: auth })).some(row => row.id === ruleId && row.threshold === 0)).toBe(true);
        await expect(page.getByText('PM25 > 0 µg/m³', { exact: true }).last()).toBeVisible();
        expect((await live('/alert-rules', { headers: otherAuth })).some(row => row.id === ruleId)).toBe(false);
        const worker = alertWorker();
        const notifications = await live('/alerts?limit=100', { headers: auth });
        await page.reload(); await tab('Saved Places');
        await page.getByRole('button', { name: 'View notifications and alert triggers', exact: true }).click();
        if (notifications.length === 0) await expect(page.getByText('No active notification alerts.', { exact: true })).toBeVisible();
        else await expect(page.getByRole('dialog')).toBeVisible();
        check('zero threshold is server-persisted and notifications remain real', { rule_id: ruleId, threshold: 0, averaging_minutes: data.averaging_period_minutes, worker, notifications: notifications.length });
        await screenshot('alerts');
      } finally {
        if (ruleId) expect((await context.request.delete(api + '/api/v1/alert-rules/' + ruleId, { headers: auth })).status()).toBe(204);
      }
    });

    await step('unsupported capabilities and viewport', async () => {
      const capabilities = await live('/capabilities');
      for (const key of ['model_forecast', 'continuous_hourly_trajectory', 'spatial_exposure', 'calibrated_intervals']) expect(capabilities[key].supported).toBe(false);
      check('public live/planning/exposure/uncertainty remain gated');
      expect(await page.locator('body').evaluate(body => body.scrollWidth <= window.innerWidth)).toBe(true);
      check('viewport has no body horizontal overflow');
    });
    profile.api_paths = [...new Set(captures.map(item => redact(`${item.method} ${item.path} ->${item.status}`)))];
    evidence.profiles.push(profile);
    await context.close();
  }
} finally {
  await browser.close();
  evidence.changed_runtime_paths = changed();
  evidence.snapshot_unchanged = evidence.changed_runtime_paths.length === 0;
  evidence.prototype_acceptance_passed = evidence.snapshot_unchanged && evidence.profiles.length === 2 && evidence.profiles.every(profile => profile.checks.every(check => check.status === 'passed'));
  evidence.passed = evidence.prototype_acceptance_passed;
  evidence.deferred_capabilities = evidence.profiles.flatMap(profile => profile.deferred_capabilities.map(item => ({ viewport: profile.viewport, ...item })));
  fs.writeFileSync(path.join(folder, 'browser-walk-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
}
console.log(JSON.stringify({ passed: evidence.passed, all_capabilities_available: evidence.all_capabilities_available, deferred_capabilities: evidence.deferred_capabilities.length, snapshot_unchanged: evidence.snapshot_unchanged, profiles: evidence.profiles.map(profile => ({ viewport: profile.viewport, passed: profile.checks.filter(check => check.status === 'passed').length, failed: profile.checks.filter(check => check.status === 'failed').length, pending: profile.checks.filter(check => check.status === 'pending').length })) }));
if (!evidence.passed) process.exitCode = 1;
