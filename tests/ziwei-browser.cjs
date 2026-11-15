// Run with ZIWEI_PLAYWRIGHT pointing to an installed Playwright package and a local server.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.ZIWEI_PLAYWRIGHT || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = process.env.ZIWEI_BASE_URL || 'http://127.0.0.1:8765';
    const output = path.join(os.tmpdir(), 'ziwei-browser-check');
    await page.goto(`${base}/physics-tools.html`);
    await page.locator('a[href="tools/ziwei.html"]').click();
    await page.locator('.palace').first().waitFor();
    assert.equal(await page.locator('.palace').count(), 12);
    assert.match(await page.locator('.chart-center').innerText(), /水二局/);
    assert.equal(await page.locator('#connections line').count(), 4);
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    await page.locator('[data-palace="3"]').click();
    assert.match(await page.locator('#palace-detail').innerText(), /官祿宮/);
    await page.locator('#show-lines').uncheck();
    assert.equal(await page.locator('#connections line').count(), 0);
    await page.locator('#show-lines').check();
    await page.locator('[data-view="yearly"]').click();
    await page.locator('#target-date').fill('2026-11-15');
    assert.match(await page.locator('.center-period').innerText(), /流年 丙午/);
    assert.equal(await page.locator('.period-tag').count(), 24);
    await page.locator('#next-period').click();
    assert.equal(await page.locator('#target-date').inputValue(), '2027-11-15');
    await page.locator('[data-view="monthly"]').click();
    await page.locator('#target-date').fill('2026-11-15');
    assert.match(await page.locator('.center-period').innerText(), /流月 己亥/);
    assert.equal(await page.locator('.period-tag').count(), 36);
    await page.locator('#next-period').click();
    assert.equal(await page.locator('#target-date').inputValue(), '2026-12-15');
    assert.doesNotMatch(await page.locator('.center-period').innerText(), /流月 己亥/);
    await page.locator('#target-date').fill('1998-01-01');
    assert.match(await page.locator('#chart-status').innerText(), /不可早於/);
    assert.equal(await page.locator('#target-date').inputValue(), '2026-12-15');
    await page.locator('#calendar').selectOption('lunar');
    await page.locator('#leap-month').check();
    await page.locator('button[type="submit"]').click();
    assert.match(await page.locator('#form-status').innerText(), /不存在/);
    assert.equal(await page.locator('.palace').count(), 12);
    await page.locator('#leap-month').uncheck();
    await page.locator('#person-name').fill('<img src=x onerror=alert(1)>');
    await page.locator('button[type="submit"]').click();
    assert.equal(await page.locator('.center-name img').count(), 0);
    assert.match(await page.locator('.center-name').innerText(), /<img/);
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#export').click();
    const download = await downloadEvent;
    const exported = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    assert.equal(exported.chart.palaces.length, 12);
    assert.equal(exported.input.calendar, 'lunar');
    await page.locator('#sample').click();
    await page.locator('[data-view="monthly"]').click();
    await page.locator('#target-date').fill('2026-11-15');
    await page.locator('[data-palace="2"]').click();
    await page.screenshot({ path: path.join(output, 'monthly.png'), fullPage: true });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: path.join(output, 'print.pdf'), preferCSSPageSize: true, printBackground: true });
    assert.equal(await page.locator('.birth-panel').isVisible(), false);
    await page.emulateMedia({ media: 'screen' });
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `page overflow at ${width}`);
      const scrolls = await page.locator('.chart-scroll').evaluate(el => el.scrollWidth > el.clientWidth);
      assert.equal(scrolls, width < 754);
      if (scrolls) {
        await page.locator('.chart-scroll').evaluate(el => { el.scrollLeft = el.scrollWidth; });
        assert.ok(await page.locator('.chart-scroll').evaluate(el => el.scrollLeft > 0));
      }
      await page.locator('.chart-scroll').evaluate(el => { el.scrollLeft = 0; });
      await page.screenshot({ path: path.join(output, `mobile-${width}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: catalog, 12 palaces, selections, lines, monthly navigation, validation, safe text, JSON export, print, mobile scrolling.');
    console.log(`Screenshots and print output: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
