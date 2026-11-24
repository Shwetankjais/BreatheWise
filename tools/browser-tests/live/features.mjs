// Opt-in integration against actual configured local assets, never synthetic forecasts.
import { chromium, expect } from '../node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const api = process.env.FEATURE_API_URL || 'http://127.0.0.1:8101';
const web = process.env.FEATURE_WEB_URL || 'http://127.0.0.1:5175';
const snapshotPath = 'work/frozen-frontend-1.2.json';
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const evidence = { verified_at: new Date().toISOString(), scope: 'Actual configured observation DB, archive, experiment registry and route provider/cache; transparent same-origin test proxy', profiles: [] };
const browser = await chromium.launch();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  for (const [name, viewport] of [['desktop', {width:1440,height:1000}], ['mobile', {width:390,height:844}]]) {
    const context = await browser.newContext({ viewport, isMobile:name==='mobile', reducedMotion:'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const captures = [];
    const profile = { viewport:name, checks:[] };
    const check = (label, passed, details={}) => profile.checks.push({name:label,passed,...details});
    const step = async (label, fn) => {try {await fn();} catch(error) {check(label,false,{error:error.message.slice(0,1800)});} };
    const capture = async (path, predicate=()=>true) => {
      for(let i=0;i<300;i++) {
        const item=captures.findLast(x=>x.path.includes(path)&&predicate(x));
        if(item)return item;
        await sleep(100);
      }
      throw new Error(`No matching actual API response for ${path}`);
    };
    await page.route('**/api/v1/**', async route => {
      const request=route.request();const url=new URL(request.url());
      const response=await route.fetch({url:api+url.pathname+url.search});
      let json=null;try{json=await response.json();}catch{}
      captures.push({path:url.pathname+url.search,status:response.status(),json,method:request.method()});
      await route.fulfill({response});
    });
    await step('actual multi-station overview', async()=>{
      await page.goto(web);
      await expect(page.getByRole('heading',{name:'Anand Vihar, New Delhi - DPCC',exact:true})).toBeVisible();
      const cat=await capture('/station-catalogue',x=>x.status===200);
      const ranks=await capture('/observed-rankings',x=>x.status===200);
      await expect(page.locator('.leaflet-marker-icon')).toHaveCount(cat.json.data.stations.length);
      const reset=page.getByRole('button',{name:'Reset map bounds',exact:true});
      await reset.click();
      const allResponse=await context.request.get(`${api}/api/v1/observed-rankings?city_id=delhi&pollutant=pm25&include_stale=true`);
      const allRanks=(await allResponse.json()).data;
      for(const row of allRanks.rows){
        const value=row.measurement.value;const expected=`${row.station.name}: ${value} µg/m³`;
        await expect(page.locator('.leaflet-marker-icon').getByRole('button',{name:expected,exact:true})).toBeVisible();
      }
      check('actual station marker values match observed API',allResponse.status()===200&&allRanks.ranking_kind==='observed_concentration'&&cat.json.data.stations.length>=3,{stations:cat.json.data.stations.length,ranked_values:allRanks.rows.map(x=>({id:x.station.id,value:x.measurement.value,stale:x.measurement.stale})),fresh_only_rank_count:ranks.json.data.rows.length,excluded_stale_count:ranks.json.data.excluded_stale_count});
      await expect(page.getByText('MODEL_UNAVAILABLE',{exact:false}).first()).toBeVisible();
    });
    await step('recorded-clock archive screen matches response',async()=>{
      await page.getByRole('tab',{name:'Historical EDA',exact:true}).click();
      await page.getByRole('button',{name:'Audited Archive (Recorded Clock)',exact:true}).click();
      await capture('/archive/catalogue',x=>x.status===200);
      const dates=page.getByPlaceholder('YYYY-MM-DDTHH:MM:SS');
      await dates.nth(0).fill('2026-10-01T00:00:00');
      await dates.nth(1).fill('2026-11-01T00:00:00');
      const result=await capture('/archive/explore',x=>x.status===200&&new URL(x.path,api).searchParams.get('end')==='2026-11-01T00:00:00');
      const data=result.json.data;
      await expect(page.getByText(`Archive Bucket Sequence (${data.points.length} Periods)`,{exact:true})).toBeVisible();
      await expect(page.getByText(data.distribution.mean.toFixed(1),{exact:true}).first()).toBeVisible();
      await expect(page.getByText('PROVENANCE DISCLAIMER:',{exact:false})).toBeVisible();
      check('archive buckets, mean and recorded-clock semantics',data.dataset_mode==='recorded_clock'&&data.timezone===null&&!data.publication_time_known,{valid:data.valid_count,expected:data.expected_count,points:data.points.length,mean:data.distribution.mean,unit:data.unit});
      const pollutant=page.locator('select').filter({has:page.locator('option[value="pm25"]')}).first();
      const coAvailable=await pollutant.locator('option[value="co"]').count();
      check('CO archive filter is available',coAvailable===1);
      if(coAvailable){
        await pollutant.selectOption('co');
        const co=await capture('/archive/explore',x=>x.status===200&&new URL(x.path,api).searchParams.get('pollutant')==='co');
        const sample=co.json.data.points.find(x=>x.value!==null);
        await expect(page.getByRole('cell',{name:`${sample.value.toFixed(1)} ${co.json.data.unit}`,exact:true}).first()).toBeVisible();
        check('CO source units preserved in screen',co.json.data.unit==='mg/m³');
        await pollutant.selectOption('pm25');
      }
      await page.getByRole('button',{name:'Matched Station Comparison (2–4 Sites)',exact:true}).click();
      const cmp=await capture('/archive/compare',x=>x.status===200);
      const dataCmp=cmp.json.data;
      await expect(page.getByText(`Matched Hours: ${dataCmp.matched_hour_count}`,{exact:false})).toBeVisible();
      const agreement=dataCmp.pair_agreement[0];
      await expect(page.getByText(`${agreement.mean_absolute_difference.toFixed(2)} ${dataCmp.unit}`,{exact:true}).first()).toBeVisible();
      check('conditional exact recorded-clock comparison matches screen',new URL(cmp.path,api).searchParams.get('clock_assumption')==='same_recorded_clock'&&dataCmp.alignment_status==='conditional_same_recorded_clock_only',{matched_hours:dataCmp.matched_hour_count,mean_absolute_difference:agreement.mean_absolute_difference});
      await page.screenshot({path:`work/archive-integrated-${name}.png`,fullPage:true,animations:'disabled'});
      await page.getByRole('button',{name:'Live CAAQMS Intake (UTC)',exact:true}).click();
      const live=await capture('/history',x=>x.status===200);
      await expect(page.getByText(/Clock: UTC Intake/)).toBeVisible();
      check('live UTC stays separate from archive clock',live.json.data.points.every(x=>/[Zz]|[+]\d\d:\d\d$/.test(x.measured_at)));
    });
    await step('retrospective evaluation and prediction values match API',async()=>{
      await page.getByRole('tab',{name:'Model Audit',exact:true}).click();
      await page.getByRole('button',{name:/Tier 2: Experimental Model/}).click();
      const result=await capture('/models/delhi-recorded-pm25-v1/evaluation',x=>x.status===200);
      const report=result.json.data;
      const table=page.getByRole('row').filter({hasText:'+1h'}).first();
      await expect(table).toBeVisible();
      const text=await table.innerText();const h1=report.horizons.find(x=>x.horizon_h===1).splits.test;
      const common=h1.common_baseline_cohort;
      check('model baseline table uses common sample cohort',text.includes(String(common.lightgbm.count))&&text.includes(common.lightgbm.mae.toFixed(1)),{expected_common_count:common.lightgbm.count,expected_common_mae:common.lightgbm.mae,displayed_row:text});
      check('retrospective model remains non-live',report.retrospective_only&&!report.live_forecast_ready&&report.timezone===null&&!report.publication_time_known,{version:report.model_version,source_station_ids:report.station_ids});
      await page.getByRole('button',{name:'+3h',exact:true}).click();
      const pred=await capture('/predictions',x=>x.status===200&&new URL(x.path,api).searchParams.get('horizon_h')==='3');
      const first=pred.json.data.points[0];
      await expect(page.getByRole('cell',{name:`${first.lightgbm.toFixed(1)} µg/m³`,exact:true}).first()).toBeVisible();
      await expect(page.getByText(first.target_at_recorded.slice(0,16),{exact:false}).first()).toBeVisible();
      check('actual heldout prediction displayed',first.horizon_h===3,{target_at_recorded:first.target_at_recorded,predicted:first.lightgbm,observed:first.observed});
      await page.screenshot({path:`work/model-integrated-${name}.png`,fullPage:true,animations:'disabled'});
      const gated=await context.request.get(`${api}/api/v1/stations/openaq-235/forecast?model_version=delhi-recorded-pm25-v1`);
      check('live selection of retrospective model is rejected',gated.status()===409&&(await gated.json()).error.code==='MODEL_RETROSPECTIVE_ONLY');
    });
    await step('actual OSRM geometry displayed without exposure',async()=>{
      await page.getByRole('tab',{name:'Routes (Exp)',exact:true}).click();
      const result=await capture('/routes/geometry',x=>x.status===200);
      const data=result.json.data;
      for(const route of data.routes){
        await expect(page.getByText(`(${route.distance_m}m)`,{exact:true})).toBeVisible();
        await expect(page.getByText(`${Math.round(route.estimated_duration_s/60)} mins`,{exact:true}).first()).toBeVisible();
      }
      await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toHaveCount(data.routes.length);
      await expect(page.getByText('Exposure Unavailable',{exact:true}).first()).toBeVisible();
      const disabled=await page.locator('option[value="walking"]').isDisabled();
      check('provider alternatives match screen and remain exposure/traffic unavailable',!data.exposure_ready&&disabled&&data.routes.every(x=>x.exposure===null&&!x.traffic_aware),{provider:data.provider,routes:data.routes.map(x=>({distance_m:x.distance_m,estimated_duration_s:x.estimated_duration_s,geometry_points:x.geometry.coordinates.length}))});
      await page.screenshot({path:`work/routes-integrated-${name}.png`,fullPage:true,animations:'disabled'});
    });
    profile.api_paths=[...new Set(captures.map(x=>`${x.method} ${x.path} ->${x.status}`))];
    evidence.profiles.push(profile);await context.close();
  }
} finally {await browser.close();}
evidence.changed_runtime_paths=Object.entries(snapshot).filter(([path,hash])=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')!==hash).map(([path])=>path);
evidence.snapshot_unchanged=evidence.changed_runtime_paths.length===0;
evidence.passed=evidence.snapshot_unchanged&&evidence.profiles.every(x=>x.checks.every(c=>c.passed));
fs.writeFileSync('work/live-frontend-evidence.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence));
process.exitCode=evidence.passed?0:1;
