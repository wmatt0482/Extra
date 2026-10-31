// Fast isolated offline regression with host-side deadlines; a stuck worker cannot stall the full smoke suite.
import {writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const trace=[],output=new URL('../docs/offline-results.json',import.meta.url);
const mark=(stage,extra={})=>{trace.push({stage,...extra});writeFileSync(output,JSON.stringify({passed:false,trace},null,2));console.log(stage);};
async function bounded(p,label,ms=15000){let timer;try{return await Promise.race([p,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(label+' timed out')),ms))]);}finally{clearTimeout(timer);}}
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1024,height:768}}),page=await context.newPage(),base=process.env.BASE_URL||'http://localhost:8080';page.on('console',m=>{if(['warning','error'].includes(m.type()))mark('console',{text:m.text()});});
 mark('load with worker');await bounded(page.goto(base+'/build-crew/'),'initial navigation');await bounded(page.waitForFunction(()=>window.__buildCrew),'boot');
 mark('wait for registration');const registration=await bounded(page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return {scope:r.scope,script:r.active?.scriptURL};}),'worker ready');mark('worker active',registration);
 await page.locator('#add-player').click();await page.keyboard.type('Offline');await page.keyboard.press('Enter');await page.locator('#sandbox').click();await page.locator('#save-yard').click();await page.locator('#home').click();
 mark('online reload');await bounded(page.reload(),'online reload');await bounded(page.waitForFunction(()=>window.__buildCrew),'online boot');
 mark('set offline');await bounded(context.setOffline(true),'offline emulation');
 mark('offline reload');await bounded(page.reload(),'offline reload');await bounded(page.waitForFunction(()=>window.__buildCrew),'offline boot');
 mark('restore saved yard');await page.locator('#my-yard').click();const state=await page.evaluate(()=>window.__buildCrew.state);if(state.blocks.length!==3)throw Error('saved yard was not restored');
 mark('success');writeFileSync(output,JSON.stringify({passed:true,trace},null,2)+'\n');
}catch(e){mark('failure',{message:e.message});await bounded(browser.close(),'browser close',5000).catch(()=>{});process.exit(1);}finally{await bounded(browser.close(),'browser close',5000).catch(()=>{});}
