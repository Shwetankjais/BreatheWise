// Public static demo verification; never claims backend or real model readiness.
import { chromium, expect } from '../node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
const url='https://shwetankjais.github.io/BreatheWise/';
const report={url,checked_at:new Date().toISOString(),scope:'GitHub Pages static demo only',profiles:[]};
const browser=await chromium.launch();
try {
  for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
    const page=await browser.newPage({viewport,reducedMotion:'reduce'});
    const errors=[];const apiRequests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiRequests.push(r.url());});
    const response=await page.goto(url);expect(response.status()).toBe(200);
    await expect(page.getByLabel('Public deployment scope')).toContainText('no hosted API or database');
    await expect(page.getByLabel('Demo mode announcement')).toBeVisible();
    const tabs=await page.getByRole('tab').allTextContents();
    const visited=[];
    for(const [index,title] of tabs.entries()){
      await page.getByRole('tab').nth(index).click();
      await expect(page.getByLabel('Demo mode announcement')).toBeVisible();
      await expect(page.getByRole('tab').nth(index)).toHaveAttribute('aria-selected','true');
      visited.push(title);
    }
    await page.reload();
    await expect(page.getByLabel('Demo mode announcement')).toBeVisible();
    expect(errors).toEqual([]);expect(apiRequests).toEqual([]);
    const width=await page.locator('body').evaluate(b=>b.scrollWidth);
    expect(width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({path:`work/github-pages-${name}.png`,fullPage:true});
    report.profiles.push({name,http_status:response.status(),demo_label:true,visited_tabs:visited,api_requests:apiRequests,page_errors:errors,body_width:width,viewport_width:viewport.width});
    await page.close();
  }
  report.passed=true;
}finally{
  await browser.close();
  fs.writeFileSync('work/github-pages-public-check.json',JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report));
