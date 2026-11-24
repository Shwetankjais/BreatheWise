// Actual localhost contract1.3 acceptance; failure/empty simulations explicitly labeled.
import { chromium, expect } from '../node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
const web='http://127.0.0.1:5173';
const api='http://127.0.0.1:8000/api/v1';
const snapshotPath='work/prototype/contract13-fingerprint.json';
const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
const report={verified_at:new Date().toISOString(),scope:'Actual localhost APIs and persisted artifacts; simulated failures explicitly identified',profiles:[]};
const browser=await chromium.launch();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
try {
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,isMobile:name==='mobile',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const captures=[];const profile={name,checks:[]};report.profiles.push(profile);
  page.on('response',async r=>{if(r.url().includes('/api/v1/')){let body;try{body=await r.json();}catch{};captures.push({url:r.url(),status:r.status(),body});}});
  const capture=async(fragment,predicate=()=>true)=>{
   for(let i=0;i<350;i++){const item=captures.findLast(x=>x.url.includes(fragment)&&x.body&&predicate(x));if(item)return item;await pause(100);}
   throw new Error('No matching API response: '+fragment);
  };
  const step=async(label,fn)=>{try{const details=await fn();profile.checks.push({name:label,passed:true,...details});}catch(error){profile.checks.push({name:label,passed:false,error:error.message.slice(0,1500)});}};
  await page.goto(web);
  await step('registry-driven recorded/UTC issue-purged evaluation and playback',async()=>{
   await page.getByRole('tab',{name:'Model Audit',exact:true}).click();
   await page.getByRole('button',{name:/Tier 2: Experimental Models?/}).click();
   const reg=await capture('/models',x=>x.status===200&&Array.isArray(x.body?.data?.models));
   const details=[];
   for(const version of ['delhi-recorded-pm25-hourly-v2','delhi-openaq-pm25-hourly-v1','delhi-recorded-pm25-v1']){
    const model=reg.body.data.models.find(x=>x.model_version===version);expect(model).toBeTruthy();
    await page.locator('#model-version-selector').selectOption(version);
    const evaluation=await capture(model.evaluation_path,x=>x.status===200&&x.body.data.model_version===version);
    const data=evaluation.body.data;
    await expect(page.getByText(version,{exact:true}).first()).toBeVisible();
    const horizonButtons=page.getByRole('button',{name:/^\+\d+h$/});
    await expect.poll(()=>horizonButtons.count()).toBe(model.supported_horizons.length);
    expect(data.supported_horizons).toEqual(model.supported_horizons);
    const isPurged=model.evaluation_cohort==='fixed_model_issue_time_purged';
    await expect(page.getByRole('checkbox',{name:'Purged Cohort'})).toBeChecked({checked:isPurged});
    const row=page.getByRole('row').filter({hasText:'+1h'}).first();
    await expect(row).toBeVisible();const rendered=await row.innerText();
    const metric=data.horizons.find(x=>x.horizon_h===1).splits.test.common_baseline_cohort.lightgbm;
    expect(rendered).toContain(String(metric.count));expect(rendered).toContain(metric.mae.toFixed(1));
    const h=version.endsWith('pm25-v1')?3:2;
    await page.getByRole('button',{name:`+${h}h`,exact:true}).click();
    const prediction=await capture(model.predictions_path,x=>x.status===200&&x.body.data.model_version===version&&new URL(x.url).searchParams.get('horizon_h')===String(h)&&new URL(x.url).searchParams.get('issue_time_purged')===String(isPurged));
    const first=prediction.body.data.points[0];expect(first).toBeTruthy();
    await expect(page.getByRole('cell',{name:`${first.lightgbm.toFixed(1)} µg/m³`,exact:true}).first()).toBeVisible();
    expect(prediction.body.data.evaluation_cohort).toBe(isPurged?'fixed_model_issue_time_purged':'target_timestamp_split_only');
    const utc=model.dataset_mode==='utc_provider_history';
    expect(utc?first.target_at_utc:first.target_at_recorded).toBeTruthy();
    await expect(page.getByRole('columnheader',{name:utc?'Target Time (UTC)':'Target Time (Recorded)',exact:true})).toBeVisible();
    details.push({version,horizons:model.supported_horizons.length,clock:model.clock_basis,cohort:data.evaluation_cohort,horizon:h,prediction:first.lightgbm,observed:first.observed});
   }
   await page.screenshot({path:`work/prototype/contract13-model-${name}.png`,fullPage:true,animations:'disabled'});
   return {models:details};
  });
  await step('actual persisted forecast-run list/detail keeps rejection and zero rows',async()=>{
   await page.getByRole('button',{name:/Tier 3: Operational Pipeline/}).click();
   await page.getByRole('button',{name:'Query Runs',exact:true}).click();
   const list=await capture('/forecast-runs',x=>x.status===200&&Array.isArray(x.body.data.runs));
   const rejected=list.body.data.runs.find(x=>x.status==='rejected');expect(rejected).toBeTruthy();
   const row=page.getByRole('row').filter({hasText:rejected.error_code}).first();
   await row.getByRole('button',{name:'View Detail',exact:true}).click();
   const detail=await capture('/forecast-runs/',x=>x.status===200&&x.body.data.run.error_code===rejected.error_code);
   await expect(page.getByText(detail.body.data.run.id,{exact:false}).first()).toBeVisible();
   await expect(page.getByText(/0 forecast rows generated/)).toBeVisible();
   expect(detail.body.data.predictions).toHaveLength(0);
   expect(detail.body.data.run.public_live_forecast_ready).toBe(false);
   return {run_id:detail.body.data.run.id,error:detail.body.data.run.error_code,predictions:0};
  });
  await step('simulated empty registry stays empty without demo model substitution',async()=>{
   await page.route('**/api/v1/models',route=>route.fulfill({status:200,json:{meta:{request_id:'explicit-empty-simulation',generated_at:new Date().toISOString(),data_mode:'live',source:'acceptance test empty simulation',contract_version:'1.4.0',quality_flags:[]},data:{models:[]}}}));
   await page.reload();
   await page.getByRole('tab',{name:'Model Audit',exact:true}).click();
   await page.getByRole('button',{name:/Tier 2: Experimental Models?/}).click();
   await expect(page.locator('#model-version-selector option')).toHaveCount(0);
   await expect(page.getByRole('button',{name:/^\+\d+h$/})).toHaveCount(0);
   await expect(page.getByLabel('Demo mode announcement')).toHaveCount(0);
   await page.unroute('**/api/v1/models');
   return {simulation:'Only registry HTTP response is explicitly empty; no fixture forecast result'};
  });
  await step('simulated registry outage remains a failure',async()=>{
   await page.route('**/api/v1/models',route=>route.fulfill({status:503,json:{meta:{request_id:'explicit-failure-simulation',generated_at:new Date().toISOString(),data_mode:'live',source:'acceptance test failure simulation',contract_version:'1.4.0',quality_flags:[]},error:{code:'TEST_REGISTRY_OUTAGE',message:'Explicit acceptance outage simulation',retryable:true,requirements_missing:[],fields:[]}}}));
   await page.reload();
   await page.getByRole('tab',{name:'Model Audit',exact:true}).click();
   await page.getByRole('button',{name:/Tier 2: Experimental Models?/}).click();
   await expect(page.getByText(/TEST_REGISTRY_OUTAGE|Explicit acceptance outage simulation/).first()).toBeVisible();
   await expect(page.getByLabel('Demo mode announcement')).toHaveCount(0);
   await page.unroute('**/api/v1/models');
   return {simulation:'Explicit503 registry test response'};
  });
  profile.api_paths=[...new Set(captures.map(x=>new URL(x.url).pathname+new URL(x.url).search+' ->'+x.status))];
  await context.close();
 }
}finally{await browser.close();}
report.changed_paths=Object.entries(snapshot.paths).filter(([p,h])=>hash(p)!==h).map(([p])=>p);
report.snapshot_unchanged=report.changed_paths.length===0;
report.passed=report.snapshot_unchanged&&report.profiles.every(p=>p.checks.every(x=>x.passed));
fs.writeFileSync('work/prototype/contract13-browser-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,changed_paths:report.changed_paths,profiles:report.profiles.map(p=>({name:p.name,checks:p.checks}))},null,2));
if(!report.passed)process.exitCode=1;
