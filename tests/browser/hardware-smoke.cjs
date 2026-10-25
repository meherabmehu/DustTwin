const { chromium } = (() => { try { return require('playwright'); } catch { return require('../../.hardware-qa/node_modules/playwright'); } })();
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  fs.mkdirSync('.hardware-qa', { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const root = process.env.DUSTTWIN_TEST_URL || 'http://127.0.0.1:5173';
  async function steps(n) { await page.evaluate(n => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Step 1s'); for (let i = 0; i < n; i++) b.click(); }, n); }
  async function load(name) { await page.getByLabel('Test scenario', { exact: true }).selectOption(name); await page.getByRole('button', { name: 'Load & run', exact: true }).click(); await page.getByRole('button', { name: 'Pause', exact: true }).first().click(); }
  try {
    await page.goto(`${root}/hardware-simulator`); await page.getByRole('heading', { name: 'Hardware Simulator', exact: true }).waitFor();
    await page.addStyleTag({content:'html,body,.hw-viewport { scroll-behavior:auto !important; }'});
    assert.equal(await page.locator('.hw-part').count(), 59);
    await page.getByLabel('Search components').fill('Raspberry'); assert.equal(await page.locator('.hw-reference-library button').count(), 1);
    await page.locator('.hw-reference-library button').click(); await page.getByLabel('Search components').fill('');
    for (const view of ['Raspberry Pi and ESP32', 'PM Sensors', 'Environmental Sensors', 'Dry Extraction', 'Water Misting', 'Power Distribution', 'Complete System']) await page.locator('.hw-filter-row').getByRole('button', { name: view, exact: true }).click();
    await page.getByLabel('Show power wires', { exact: true }).check();
    await page.getByLabel('Trace selected only', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click(); await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await page.getByRole('button', { name: 'Fit screen', exact: true }).click(); await page.getByRole('button', { name: 'Reset view', exact: true }).click();
    await page.getByRole('button', { name: 'Full screen', exact: true }).click(); assert.equal(await page.locator('.hw-fullscreen').count(), 1); await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
    if(!await page.locator('#hw-part-select').count()) await page.getByRole('button', { name: 'Inspector', exact: true }).click(); await page.locator('#hw-part-select').selectOption('pm0');
    await page.locator('[data-component="pm0"][data-pin="2 SDA"]').click(); assert.match(await page.locator('.hw-lab-inspector').innerText(), /Selected pin: 2 SDA/);
    await page.locator('.hw-connection-list button').first().click(); assert.match(await page.locator('.hw-lab-inspector').innerText(), /3.3V/);
    await load('Northwest wind'); await steps(4); assert.match(await page.locator('.hw-zone').nth(0).innerText(), /SPRAYING/); assert.match(await page.locator('.hw-zone').nth(3).innerText(), /SPRAYING/); assert.match(await page.locator('.hw-zone').nth(1).innerText(), /CLOSED/);
    await page.getByRole('button', { name: 'Emergency stop', exact: true }).click(); assert.equal(await page.locator('.hw-zone').filter({ hasText: 'SPRAYING' }).count(), 0);
    const scenarios = await page.getByLabel('Test scenario').locator('option').allTextContents();
    for (const name of scenarios) { await load(name); await steps(4); }
    console.log(`PASS: circuit views, trace/search/zoom/fullscreen and ${scenarios.length} functional scenarios`);
    await page.getByRole('button', { name: 'Reset', exact: true }).first().click(); await page.getByLabel('Control mode', { exact: true }).selectOption('Manual'); await steps(1);
    await page.locator('.hw-zone').first().getByRole('button', { name: 'Damper open', exact: true }).click(); await page.locator('.hw-zone').first().getByRole('button', { name: 'Valve open', exact: true }).click(); await page.getByRole('button', { name: 'Motor request ON', exact: true }).click(); await page.getByRole('button', { name: 'Pump request ON', exact: true }).click(); await steps(4); assert.match(await page.locator('.hw-zone').first().innerText(), /SPRAYING/);
    await page.getByRole('button', { name: /12V test fan:/ }).click(); await page.getByRole('button', { name: 'Refill tank', exact: true }).click(); await page.getByRole('button', { name: 'Service filter & bin', exact: true }).click();
    // Inspector accordion can be collapsed to reach sensor controls in the resizable right panel.
    await page.getByRole('button', { name: 'Sensor inputs', exact: true }).click();
    for (const name of ['Untreated PM2.5 peak','Untreated PM10 peak','Wind speed','Wind direction','Temperature','Humidity','Dust intensity']) await page.getByRole('slider', { name, exact: true }).fill(name === 'Wind speed' ? '7' : name === 'Wind direction' ? '315' : '40');
    await page.locator('.hw-lab-inspector summary').filter({ hasText: 'Independent SPS30 channel' }).click();
    await page.getByLabel('PM channel', { exact: true }).selectOption('2'); await page.getByLabel('Channel pm25', { exact: true }).fill('50'); await page.getByLabel('Channel pm10', { exact: true }).fill('100'); await page.getByLabel('Channel fault', { exact: true }).selectOption('disconnected'); await page.getByLabel('Channel fault', { exact: true }).selectOption('none');
    await page.getByRole('tab', { name: 'Sensor telemetry', exact: true }).click(); assert.equal(await page.locator('.hw-telemetry tbody').first().locator('tr').count(), 4);
    const canvas=page.getByLabel('Interactive 3D DustTwin tabletop prototype',{exact:true}); await canvas.scrollIntoViewIfNeeded(); const before=await canvas.screenshot();await page.getByRole('button',{name:'Top View',exact:true}).click();await page.waitForTimeout(150);assert.notDeepEqual(await canvas.screenshot(),before,'3D camera changes actual render');await page.getByRole('button',{name:'Side View',exact:true}).click();await page.getByRole('button',{name:'Isometric View',exact:true}).click();await page.getByRole('button',{name:'Zoom 3D in',exact:true}).click();await page.getByRole('button',{name:'Zoom 3D out',exact:true}).click();await page.getByRole('button',{name:'Rotate 3D',exact:true}).click();console.log('PASS: manual interlocks, independent PM channels and real WebGL camera');
    await page.getByRole('tab', { name: 'Code workspace', exact: true }).click();
    for (const name of ['ESP32 Sensor Firmware','ESP32 Actuator Firmware','Raspberry Pi Application','Shared Control Protocol','Simulation Configuration']) { await page.getByRole('tab', { name, exact: true }).click(); assert.ok((await page.locator('#hw-code-editor').inputValue()).length > 100); }
    const original = JSON.parse(await page.locator('#hw-code-editor').inputValue());
    await page.locator('#hw-code-editor').fill('{"damperTravelSeconds":0}'); await page.getByRole('button', { name: 'Save working copy & apply', exact: true }).click(); assert.match(await page.locator('.hw-save-message').innerText(), /Could not save/);
    await page.locator('#hw-code-editor').fill(JSON.stringify({ ...original, damperTravelSeconds: 6, nominalAirflowM3h: 900 })); await page.getByRole('button', { name: 'Save working copy & apply', exact: true }).click(); assert.match(await page.locator('.hw-save-message').innerText(), /applied/);
    const zip = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export firmware project ZIP', exact: true }).click(); await (await zip).saveAs('.hardware-qa/export.zip');
    await page.reload(); await page.getByRole('tab', { name: 'Code workspace', exact: true }).click(); await page.getByRole('tab', { name: 'Simulation Configuration', exact: true }).click(); assert.match(await page.locator('#hw-code-editor').inputValue(), /900/); await page.getByRole('button', { name: 'Reset file', exact: true }).click();
    await page.getByRole('button', { name: 'Save working copy & apply', exact: true }).click();
    await page.getByRole('tab', { name: 'Hardware Readiness', exact: true }).click(); assert.match(await page.locator('.hw-readiness').innerText(), /Requires physical verification/);
    console.log('PASS: actual firmware source, configuration validation, local persistence, ZIP export and readiness');
    await page.getByRole('button', { name: 'Reset', exact: true }).first().click();
    const predict = page.waitForResponse(r => r.url().includes('/v1/predict') && r.request().method() === 'POST'); await steps(121); const response = await predict; assert.equal(response.status(), 200); assert.equal((await response.json()).mode, 'live_inference'); await page.waitForFunction(() => document.querySelector('.hw-ai-message').textContent.includes('Existing trained model'));
    await steps(30); await page.getByRole('tab', { name: 'Sensor telemetry', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('.hw-telemetry tbody')[1].querySelectorAll('tr').length > 0);
    await page.route('**/v1/predict', r => r.abort()); await steps(5); await page.waitForFunction(() => document.querySelector('.hw-ai-message').textContent.includes('AI unavailable')); await page.unroute('**/v1/predict'); await steps(5); await page.waitForFunction(() => document.querySelector('.hw-ai-message').textContent.includes('Existing trained model'));
    console.log('PASS: real AI, matured prediction timing and offline/recovery');
    await load('Northwest wind'); await steps(1); await page.getByLabel('Host execution', { exact: true }).selectOption('python'); await page.waitForFunction(() => document.querySelector('.hw-ai-message').textContent.includes('Python host executed')); await steps(4); await page.waitForFunction(() => document.querySelector('.hw-ai-message').textContent.includes('Python host executed'));
    await page.getByRole('tab', { name: 'Actuators & flows', exact: true }).click(); assert.match(await page.locator('.hw-zone').first().innerText(), /SPRAYING/);
    await page.route('http://127.0.0.1:8010/**', r => r.abort()); await steps(1); await page.waitForFunction(() => document.querySelector('.hw-ai-message').textContent.includes('Python host offline')); assert.equal(await page.locator('.hw-zone').filter({ hasText: 'SPRAYING' }).count(), 0); await page.unroute('http://127.0.0.1:8010/**'); await steps(1); await page.waitForFunction(() => document.querySelector('.hw-ai-message').textContent.includes('Python host executed'));
    await page.getByLabel('Host execution', { exact: true }).selectOption('browser'); await steps(4);
    await page.screenshot({ path: '.hardware-qa/desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '.hardware-qa/mobile.png', fullPage: true }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No mobile page overflow');
    await page.setViewportSize({ width: 1700, height: 1100 });
    await page.getByRole('tab', { name: 'Serial events', exact: true }).click(); const event = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export log', exact: true }).click(); assert.equal((await event).suggestedFilename(), 'dusttwin-hardware-events.json'); await page.getByRole('button', { name: 'Clear', exact: true }).click();
    for (const route of ['/', '/problem', '/how-it-works', '/simulation', '/circuit-simulation', '/prototype', '/results', '/team']) { await page.goto(root + route); await page.locator('main h1').first().waitFor(); assert.equal(await page.locator('.main-nav').getByRole('link', { name: 'Hardware Simulator', exact: true }).count(), 1); }
    assert.deepEqual(errors, []); fs.writeFileSync('.hardware-qa/report.json', JSON.stringify({ status: 'pass', scenarios: scenarios.length, realAI: true, pythonHost: true, zipExport: true, firmwareExecution: false, pageErrors: errors }, null, 2));
    console.log('PASS: Python host→virtual actuators, outage fail-off, desktop/mobile, nine routes, no uncaught errors');
  } catch(error) { await page.screenshot({path:'.hardware-qa/failure.png',fullPage:true}).catch(()=>{}); throw error; } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
