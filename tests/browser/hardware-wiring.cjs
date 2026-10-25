const {chromium}=require('../../.hardware-qa/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1700,height:1100}});page.setDefaultTimeout(25000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root=process.env.DUSTTWIN_TEST_URL||'http://127.0.0.1:5173';
 try{
  await page.goto(root+'/hardware-simulator');await page.locator('.hw-part').first().waitFor();console.log('Loaded circuit');
  assert.equal(await page.locator('.hw-part').count(),59);assert.equal(await page.locator('.hw-wire').count(),165);
  await page.addStyleTag({content:'html,body,.hw-viewport { scroll-behavior:auto !important; }'});
  const canvas=page.locator('.hw-viewport'),svg=page.locator('[data-hardware-circuit]');
  const original=await svg.getAttribute('width');await canvas.hover();const scroll=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,-350);await page.waitForTimeout(150);assert.ok(Number(await svg.getAttribute('width'))>Number(original));assert.equal(await page.evaluate(()=>scrollY),scroll);
  await page.getByRole('button',{name:'Fit screen',exact:true}).click();
  for(const view of ['PM Sensors','Environmental Sensors','Raspberry Pi and ESP32','Dry Extraction','Water Misting','Power Distribution','Communication','Safety & Protection']){
    await page.locator('.hw-filter-row').getByRole('button',{name:view,exact:true}).click();
    await page.waitForFunction(()=>{const v=document.querySelector('.hw-viewport'),s=v.querySelector('svg');return s.clientWidth<=v.clientWidth+2&&s.clientHeight<=v.clientHeight+2;});
    assert.ok(await page.locator('.hw-part').count()>0);assert.ok(await page.locator('.hw-external-links').count()>0);
    const fits=await canvas.evaluate(v=>{const s=v.querySelector('svg');return s.clientWidth<=v.clientWidth+2&&s.clientHeight<=v.clientHeight+2;});assert.ok(fits,view+' fits viewport');console.log('Fitted '+view);
  }
  await page.locator('.hw-filter-row').getByRole('button',{name:'Complete System',exact:true}).click();
  assert.ok(await page.locator('[data-bus-collapsed=true]').count()>0);
  await page.getByLabel('Expand shared buses',{exact:true}).check();assert.equal(await page.locator('[data-bus-collapsed=true]').count(),0);assert.equal(await page.locator('[data-wire-route]').count(),165);
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  await page.locator('.hw-minimap').click({position:{x:120,y:95}});
  const afterMap=await canvas.evaluate(v=>({x:v.scrollLeft,y:v.scrollTop}));assert.ok(afterMap.y>0);
  await canvas.evaluate(v=>v.scrollTo(0,0));const rect=await canvas.boundingBox();
  await page.mouse.move(rect.x+12,rect.y+12);await page.mouse.down();await page.mouse.move(rect.x-80,rect.y-80,{steps:5});await page.mouse.up();
  assert.ok(await canvas.evaluate(v=>v.scrollLeft>0||v.scrollTop>0),'drag pans the canvas');
  await canvas.focus();await page.keyboard.press('f');
  await page.getByRole('button',{name:'Inspector',exact:true}).click();await page.locator('#hw-part-select').selectOption('pm0');
  await page.getByRole('button',{name:'Center selected component',exact:true}).click();
  await page.locator('[data-component="pm0"][data-pin="2 SDA"]').click();assert.match(await page.locator('.hw-lab-inspector').innerText(),/Selected pin: 2 SDA/);
  await page.locator('.hw-connection-list button').filter({hasText:'mux:SD0'}).click();
  assert.equal(await page.locator('[data-endpoint-highlighted=true]').count(),2);
  assert.equal(await page.locator('[data-wire-id=w11]').getAttribute('data-highlighted'),'true');
  await page.getByRole('button',{name:'Trace selected connection',exact:true}).click();assert.equal(await page.locator('.hw-wire').count(),1);
  await page.getByRole('button',{name:'Reset wire visibility',exact:true}).click();
  await page.getByRole('button',{name:'Show water flow only',exact:true}).click();
  assert.equal(await page.locator('.hw-wire').count(),10);
  await page.getByRole('button',{name:'Reset wire visibility',exact:true}).click();
  await page.getByRole('button',{name:'Isolate selected component',exact:true}).click();assert.ok(await page.locator('.hw-part[opacity="0.12"]').count()>0);
  await page.getByRole('button',{name:'Reset wire visibility',exact:true}).click();
  await page.getByRole('button',{name:'Full screen',exact:true}).click();assert.equal(await page.locator('.hw-fullscreen').count(),1);
  await page.getByRole('button',{name:'Exit full screen',exact:true}).click();
  await page.getByRole('button',{name:'Close inspector',exact:true}).click();
  await page.getByLabel('Search components',{exact:true}).fill('Raspberry');await page.locator('.hw-reference-library button').click();
  assert.match(await page.locator('.hw-lab-inspector').innerText(),/Raspberry Pi 5/);
  await page.locator('.hw-filter-row').getByRole('button',{name:'Communication',exact:true}).click();
  await page.waitForFunction(()=>{const v=document.querySelector('.hw-viewport'),s=v.querySelector('svg');return s.clientWidth<=v.clientWidth+2&&s.clientHeight<=v.clientHeight+2;});
  await page.getByRole('button',{name:'Fit screen',exact:true}).click();await page.getByRole('button',{name:'Close inspector',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Fit screen',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log('PASS: 9 fitted views, 165 expanded routes, exact pin trace, wire selection, bus expansion, filters, isolation, wheel zoom, sidebar center, fullscreen and mobile');
 }catch(e){console.error(e);await page.screenshot({path:'.hardware-qa/wiring-failure.png',fullPage:true,timeout:5000}).catch(()=>{});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
