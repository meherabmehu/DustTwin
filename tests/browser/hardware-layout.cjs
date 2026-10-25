const {chromium}=(()=>{try{return require('playwright');}catch{return require('../../.hardware-qa/node_modules/playwright');}})();
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();page.setDefaultTimeout(30000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root=process.env.DUSTTWIN_TEST_URL||'http://127.0.0.1:5173';
 const workspace=page.locator('.hw-realistic-circuit'),svg=page.locator('[data-hardware-circuit]'),canvas=page.locator('.hw-viewport');
 const zoom=async()=>Number(await svg.getAttribute('data-zoom'));
 const report=[];
 try{
  for(const [width,height] of [[1366,768],[1440,900],[1920,1080]]){
   await page.setViewportSize({width,height});await page.goto(root+'/hardware-simulator');await page.locator('.hw-overview-part').first().waitFor();
   await page.addStyleTag({content:'html,body {scroll-behavior:auto!important}'});
   await page.waitForFunction(()=>Number(document.querySelector('[data-hardware-circuit]').dataset.zoom)>=.9);
   assert.equal(await page.locator('.hw-part').count(),59);assert.equal(await workspace.getAttribute('data-display-mode'),'overview');
   const fill=await canvas.evaluate(v=>v.querySelector('svg').getBoundingClientRect().width/v.clientWidth);assert.ok(fill>=.93&&fill<=1.02,'overview occupies available width');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await workspace.screenshot({path:`.hardware-qa/layout-overview-${width}.png`,timeout:30000});
   const initialZoom=await zoom();await page.getByRole('button',{name:'Full screen',exact:true}).click();
   await page.getByRole('button',{name:'Fit Overview',exact:true}).click();
   await workspace.screenshot({path:`.hardware-qa/layout-fullscreen-${width}.png`,timeout:30000});
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.hw-fullscreen'));
   await page.waitForFunction(z=>Number(document.querySelector('[data-hardware-circuit]').dataset.zoom)===z,initialZoom);
   await page.getByRole('button',{name:'Fit Overview',exact:true}).click();await page.waitForTimeout(80);
   assert.ok(await zoom()<initialZoom,'explicit fit is separate from readable default');
   assert.ok(await canvas.evaluate(v=>v.querySelector('svg').getBoundingClientRect().height<=v.clientHeight+2),'full overview fits its height');
   await page.getByRole('button',{name:'Reset View',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('[data-hardware-circuit]').dataset.zoom)>=.9);
   await page.getByRole('button',{name:'Actual Size',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.hw-realistic-circuit').dataset.displayMode==='detail'&&Number(document.querySelector('[data-hardware-circuit]').dataset.zoom)===1);
   await page.getByRole('button',{name:'Reset View',exact:true}).click();
   await page.locator('.hw-filter-row').getByRole('button',{name:'PM Sensors',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.hw-realistic-circuit').dataset.displayMode==='detail'&&Number(document.querySelector('[data-hardware-circuit]').dataset.zoom)>=.85);
   await page.getByRole('button',{name:'Fit Subsystem',exact:true}).click();assert.ok(await zoom()>=.85);
   const font=await page.locator('[data-component="esp1"][data-pin="GPIO21"] text').evaluate(t=>parseFloat(getComputedStyle(t).fontSize));assert.ok(font*await zoom()>=10);
   await page.getByRole('button',{name:'Actual Size',exact:true}).click();assert.equal(await zoom(),1);
   await workspace.screenshot({path:`.hardware-qa/layout-detail-${width}.png`,timeout:30000});
   report.push({width,height,overviewWidthFill:fill,pinScreenPixels:font});console.log('PASS: readable overview and pin detail at '+width+'×'+height);
  }
  await page.getByRole('button',{name:'Reset View',exact:true}).click();
  for(const name of ['Raspberry Pi and ESP32','PM Sensors','Environmental Sensors','Dry Extraction','Water Misting','Power Distribution','Communication','Safety & Protection']){
   await page.locator('.hw-filter-row').getByRole('button',{name,exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('[data-hardware-circuit]').dataset.zoom)>=.85);assert.ok(await page.locator('.hw-external-links').count());
  }
  await page.locator('.hw-filter-row').getByRole('button',{name:'Complete System',exact:true}).click();
  await page.getByRole('button',{name:'Detailed Wiring',exact:true}).click();
  await page.locator('.hw-wire-options>summary').click();assert.equal(await page.locator('.hw-wire').count(),165);
  await page.getByLabel('Expand shared buses',{exact:true}).check();assert.equal(await page.locator('[data-wire-route]').count(),165);
  await page.getByRole('button',{name:'Show water flow only',exact:true}).click();assert.equal(await page.locator('.hw-wire').count(),10);
  await page.getByRole('button',{name:'Reset wire visibility',exact:true}).click();
  await page.getByRole('button',{name:'Mini-map',exact:true}).click();await page.locator('.hw-minimap').click({position:{x:110,y:90}});assert.ok(await canvas.evaluate(v=>v.scrollTop>0));
  await page.getByRole('button',{name:'Mini-map',exact:true}).click();
  await canvas.evaluate(v=>v.scrollTo(0,0));await canvas.scrollIntoViewIfNeeded();const area=await canvas.boundingBox();
  await page.mouse.move(area.x+10,area.y+10);await page.mouse.down();await page.mouse.move(area.x-70,area.y-70,{steps:4});await page.mouse.up();assert.ok(await canvas.evaluate(v=>v.scrollLeft>0||v.scrollTop>0));
  const priorZoom=await zoom();const pageScroll=await page.evaluate(()=>scrollY);await canvas.hover();await page.mouse.wheel(0,-100);await page.waitForTimeout(80);assert.ok(await zoom()>priorZoom);assert.equal(await page.evaluate(()=>scrollY),pageScroll);
  await page.getByLabel('Search components',{exact:true}).fill('SPS30');await page.locator('.hw-reference-library button').first().click();
  await page.waitForFunction(()=>document.querySelector('.hw-part.selected')?.dataset.partId==='pm0');
  assert.ok(await zoom()>=.85);await page.locator('[data-component="pm0"][data-pin="2 SDA"]').click();
  await page.locator('.hw-connection-list button').filter({hasText:'mux:SD0'}).click();assert.equal(await page.locator('[data-endpoint-highlighted=true]').count(),2);
  await page.getByRole('button',{name:'Trace selected connection',exact:true}).click();assert.equal(await page.locator('.hw-wire').count(),1);
  const selected=await page.locator('.hw-part.selected').getAttribute('data-part-id');
  const before={zoom:await zoom(),scroll:await canvas.evaluate(v=>({left:v.scrollLeft,top:v.scrollTop}))};
  await page.getByRole('button',{name:'Full screen',exact:true}).click();await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.hw-fullscreen'));
  assert.equal(await zoom(),before.zoom);assert.equal(await page.locator('.hw-part.selected').getAttribute('data-part-id'),selected);assert.equal(await page.locator('[data-endpoint-highlighted=true]').count(),2);
  await page.waitForFunction(b=>{const v=document.querySelector('.hw-viewport');return Math.abs(v.scrollLeft-b.left)<2&&Math.abs(v.scrollTop-b.top)<2;},before.scroll);
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();const stable=await zoom();
  await page.getByRole('button',{name:'Start',exact:true}).click();await page.waitForTimeout(1200);await page.getByRole('button',{name:'Pause',exact:true}).first().click();assert.equal(await zoom(),stable);
  await page.getByRole('button',{name:'System Overview',exact:true}).click();await page.getByRole('button',{name:'Detailed Wiring',exact:true}).click();await page.waitForFunction(expected=>Number(document.querySelector('[data-hardware-circuit]').dataset.zoom)===expected,stable);assert.equal(await zoom(),stable);
  await page.getByRole('button',{name:'Reset View',exact:true}).click();await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);fs.writeFileSync('.hardware-qa/layout-report.json',JSON.stringify({status:'pass',screens:report,errors},null,2));console.log('PASS: 9 views, 165 routes, search, exact pins, camera persistence, fullscreen restoration, simulation stability and mobile');
 }catch(e){console.error(e);await page.screenshot({path:'.hardware-qa/layout-failure.png',fullPage:true,timeout:8000}).catch(()=>{});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
