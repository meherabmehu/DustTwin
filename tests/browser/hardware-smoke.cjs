// Run with Playwright installed: node tests/browser/hardware-smoke.cjs
// Local test-only installation also supported at .hardware-qa/node_modules.
const { chromium } = (() => { try { return require('playwright'); } catch { return require('../../.hardware-qa/node_modules/playwright'); } })();
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  fs.mkdirSync('.hardware-qa', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1536, height: 1100 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const root = process.env.DUSTTWIN_TEST_URL || 'http://127.0.0.1:5173';
  try {
    await page.goto(`${root}/hardware-simulator`);
    await page.getByRole('heading', { name: 'Hardware Simulator', exact: true }).waitFor();
    assert.equal(await page.locator('.hw-part').count(), 52);
    for (const name of ['Raspberry Pi 5 · 8GB', 'ESP32 #1 · Sensors', 'ESP32 #2 · Actuators']) assert.equal(await page.getByRole('button', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).count(), 1);
    await page.getByRole('button', { name: 'Fit width', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await page.locator('.hw-filter-row').getByRole('button', { name: 'Sensors', exact: true }).click();
    assert.ok(await page.locator('.hw-part').count() < 52);
    await page.getByRole('button', { name: 'Collapse Sensors', exact: true }).click();
    assert.equal(await page.locator('.hw-part.sensor').count(), 0);
    await page.getByRole('button', { name: 'Expand Sensors', exact: true }).click();
    await page.locator('#hw-part-select').selectOption('pm0');
    await page.locator('.hw-connection-list button').first().click();
    assert.match(await page.locator('.hw-inspector').innerText(), /CONNECTION INSPECTOR/);
    await page.getByLabel('All power wires').check();
    await page.locator('.hw-filter-row').getByRole('button', { name: 'Complete System', exact: true }).click();
    await page.locator('#hw-scenario').selectOption('Northwest wind');
    await page.getByRole('button', { name: 'Load & run', exact: true }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Step 1s', exact: true }).click({ clickCount: 3 });
    // Dispatch exact steps without wall-clock waiting; React queues the actual reducer actions.
    await page.evaluate(() => { const step = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Step 1s'); for (let i = 0; i < 4; i++) step.click(); });
    await page.waitForFunction(() => document.querySelectorAll('.hw-zone')[0].textContent.includes('OPEN'));
    assert.match(await page.locator('.hw-zone').nth(0).innerText(), /SPRAYING/);
    assert.match(await page.locator('.hw-zone').nth(1).innerText(), /CLOSED/);
    assert.match(await page.locator('.hw-zone').nth(3).innerText(), /SPRAYING/);
    await page.getByRole('button', { name: 'Emergency stop', exact: true }).click();
    assert.ok((await page.locator('.hw-health').innerText()).includes('actuator power inhibited'));
    assert.equal(await page.locator('.hw-zone').filter({ hasText: 'SPRAYING' }).count(), 0);
    for (const name of ['Normal air quality', 'Heavy drilling', 'North boundary exposure', 'Northwest wind', 'Multiple exposed zones', 'High PM10', 'Dry extraction active', 'Misting active', 'Hybrid operation', 'Sensor disconnected', 'Damper malfunction', 'HEPA filter clogged', 'Pump failure', 'Emergency stop']) {
      await page.locator('#hw-scenario').selectOption(name); await page.getByRole('button', { name: 'Load & run', exact: true }).click();
      assert.ok((await page.getByRole('log').innerText()).includes(`Scenario loaded: ${name}`));
    }
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    console.log('PASS: diagram, scenario loading and emergency stop');
    await page.getByLabel('Control mode', { exact: true }).selectOption('Manual');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.locator('.hw-zone').first().getByRole('button', { name: 'Damper open', exact: true }).click();
    await page.locator('.hw-zone').first().getByRole('button', { name: 'Valve open', exact: true }).click();
    await page.getByRole('button', { name: 'Request ON', exact: true }).first().click();
    await page.getByRole('button', { name: 'Request ON', exact: true }).last().click();
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Step 1s'); for (let i = 0; i < 4; i++) b.click(); });
    assert.match(await page.locator('.hw-zone').first().innerText(), /SPRAYING/);
    for (const name of ['PM2.5', 'PM10', 'Wind speed', 'Wind direction', 'Temperature', 'Humidity', 'Dust intensity']) {
      const slider = page.getByRole('slider', { name, exact: true }); await slider.fill(name === 'Wind direction' ? '90' : name === 'Wind speed' ? '7' : '40');
    }
    await page.getByLabel('Inject fault', { exact: true }).selectOption('power');
    assert.match(await page.locator('.hw-health').innerText(), /missing\/stale sensor data/);
    await page.getByLabel('Inject fault', { exact: true }).selectOption('none');
    await page.getByRole('button', { name: /12V test fan/ }).click();
    console.log('PASS: manual controls, sensor inputs and faults');
    for (const name of ['ESP32 Sensor Controller', 'ESP32 Actuator Controller', 'Raspberry Pi Controller', 'Shared control logic', 'Simulation Configuration']) {
      await page.getByRole('tab', { name, exact: true }).click(); assert.ok((await page.locator('#hw-code-editor').inputValue()).length > 20);
    }
    await page.locator('#hw-code-editor').fill('{"damperTravelSeconds":0}');
    await page.getByRole('button', { name: 'Save working copies & apply config', exact: true }).click();
    assert.match(await page.locator('.hw-save-message').innerText(), /Could not save/);
    await page.locator('#hw-code-editor').fill('{"damperTravelSeconds":6,"nominalAirflowM3h":900,"hepaTripPa":350}');
    await page.getByRole('button', { name: 'Save working copies & apply config', exact: true }).click();
    assert.match(await page.locator('.hw-health').innerText(), /trip 350 Pa/);
    const dl = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export file', exact: true }).click(); assert.equal((await dl).suggestedFilename(), 'hardware-config.json');
    await page.reload(); await page.getByRole('tab', { name: 'Simulation Configuration', exact: true }).click();
    assert.match(await page.locator('#hw-code-editor').inputValue(), /900/);
    await page.getByRole('button', { name: 'Reset file', exact: true }).click();
    await page.getByRole('button', { name: 'Save working copies & apply config', exact: true }).click();
    // Request actual backend inference from the reducer's 121 virtual history points.
    console.log('PASS: code workspace validation, export and persistence');
    const prediction = page.waitForResponse(r => r.url().includes('/v1/predict') && r.request().method() === 'POST', { timeout: 15000 });
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Step 1s'); for (let i = 0; i < 121; i++) b.click(); });
    const response = await prediction; assert.equal(response.status(), 200);
    const result = await response.json(); assert.equal(result.mode, 'live_inference'); assert.equal(result.horizon_seconds, 30);
    await page.waitForFunction(() => document.querySelector('.hw-ai-message').textContent.includes('Existing trained model'));
    await page.screenshot({ path: '.hardware-qa/desktop.png', fullPage: true });
    const eventDl = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export log', exact: true }).click(); assert.equal((await eventDl).suggestedFilename(), 'dusttwin-hardware-events.json');
    await page.getByRole('button', { name: 'Clear', exact: true }).click(); assert.match(await page.getByRole('log').innerText(), /No events/);
    // Recovery is tested against the live response before blocking the endpoint.
    await page.route('**/v1/predict', route => route.abort());
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Step 1s'); for (let i = 0; i < 5; i++) b.click(); });
    await page.waitForFunction(() => document.querySelector('.hw-ai-message').textContent.includes('AI unavailable'));
    await page.unroute('**/v1/predict');
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Step 1s'); for (let i = 0; i < 5; i++) b.click(); });
    await page.waitForFunction(() => document.querySelector('.hw-ai-message').textContent.includes('Existing trained model'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '.hardware-qa/mobile.png', fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, 'no mobile document overflow');
    await page.setViewportSize({ width: 1536, height: 1100 });
    for (const route of ['/', '/problem', '/how-it-works', '/simulation', '/circuit-simulation', '/prototype', '/results', '/team']) {
      await page.goto(`${root}${route}`); await page.locator('main h1').first().waitFor();
      assert.equal(await page.locator('.main-nav').getByRole('link', { name: 'Hardware Simulator', exact: true }).count(), 1);
    }
    assert.deepEqual(errors, [], 'no uncaught browser exceptions');
    fs.writeFileSync('.hardware-qa/report.json', JSON.stringify({ status: 'pass', routes: 9, scenarios: 14, realAI: true, mobileOverflow: false, pageErrors: errors }, null, 2));
    console.log('PASS: hardware interactions, 14 scenarios, real AI + outage recovery, code persistence/export, nine routes, desktop/mobile.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
