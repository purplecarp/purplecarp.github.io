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
    await page.locator('.chart-section').screenshot({ path: path.join(output, 'print-layout.png') });
    await page.emulateMedia({ media: 'screen' });
    for (const width of [320, 390, 768, 844, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForFunction(() => {
        const box = document.getElementById('astrolabe').getBoundingClientRect();
        return box.width <= document.getElementById('chart-scroll').clientWidth + 1;
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `page overflow at ${width}`);
      assert.equal(await page.locator('.chart-scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
      const boundsFit = await page.evaluate(() => {
        const container = document.querySelector('.chart-scroll').getBoundingClientRect();
        return [...document.querySelectorAll('.palace')].every(el => {
          const rect = el.getBoundingClientRect();
          return rect.left >= container.left && rect.right <= container.right + 1 && rect.bottom <= container.bottom + 1;
        });
      });
      assert.equal(boundsFit, true, `all 12 palaces visible at ${width}`);
      await page.screenshot({ path: path.join(output, `mobile-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#chart-size').click();
    assert.equal(await page.locator('#chart-size').getAttribute('aria-pressed'), 'true');
    await page.locator('.chart-scroll').evaluate(el => { el.scrollLeft = el.scrollWidth; });
    assert.ok(await page.locator('.chart-scroll').evaluate(el => el.scrollLeft > 0));
    await page.locator('[data-palace="6"]').click();
    assert.equal(await page.locator('[data-palace="6"]').getAttribute('aria-pressed'), 'true');
    // Print while zoomed on a phone: screen transforms must not affect A4 output.
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: path.join(output, 'print-mobile.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    await page.locator('#chart-size').click();
    for (const view of ['origin', 'yearly']) {
      await page.locator(`[data-view="${view}"]`).click();
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: path.join(output, `print-${view}.pdf`), preferCSSPageSize: true, printBackground: true });
      await page.emulateMedia({ media: 'screen' });
    }
    await page.locator('[data-view="monthly"]').click();
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.astrolabe').evaluate(el => getComputedStyle(el).transform), 'none');
    const overflow = await page.locator('.palace').evaluateAll(items => items.filter(el => el.scrollHeight > el.clientHeight + 1).map(el => el.dataset.palace));
    assert.deepEqual(overflow, [], 'printed palace contents fit their cells');
    await page.emulateMedia({ media: 'screen' });
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: catalog, 12 palaces, selections, lines, flow navigation, validation, safe text, JSON export, A4 print layout, automatic scaling at 320–1024 px, and optional zoom.');
    console.log(`Screenshots and print output: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
